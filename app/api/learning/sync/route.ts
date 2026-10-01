import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {NextRequest,NextResponse} from "next/server";
import {sameOriginOrIngestToken} from "@/lib/server/learning-auth";
import {decryptLearningSecret} from "@/lib/server/learning-crypto";
import {
  createSyncJob,findBatchByKey,findLearningObject,getDriveAccount,insertBatch,insertLearningObject,insertObservations,
  touchLearningObject,updateDriveAccount,updateSyncJob,upsertRuns
} from "@/lib/server/learning-db";
import {scanSkillCandidate} from "@/lib/server/learning-intelligence";
import {extractLearningObservations,extractSceneArtifacts,sanitizeLearningEvent,type CloudLearningEvent} from "@/lib/server/learning-sanitize";
import {refreshDriveAccessToken,uploadDriveFile} from "@/lib/server/google-drive";

export const runtime="nodejs";
export const maxDuration=60;

function hash(value:string){
  return createHash("sha256").update(value).digest("hex");
}

function summarizeRuns(events:CloudLearningEvent[],batchId:string){
  const groups=new Map<string,CloudLearningEvent[]>();
  for(const event of events){
    if(!event.runId)continue;
    const list=groups.get(event.runId)||[];
    list.push(event);groups.set(event.runId,list);
  }
  const rows:Record<string,unknown>[]=[];
  for(const [runId,list] of groups){
    list.sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)));
    const first=list[0]!,last=list[list.length-1]!;
    const generated=list.find(e=>e.type==="generation.completed");
    const exportEvent=[...list].reverse().find(e=>e.type.startsWith("export."));
    const feedback=[...list].reverse().find(e=>e.type==="feedback.recorded");
    const initialScene=generated?.payload?.scene;
    const finalScene=[...list].reverse().find(e=>e.payload&&typeof e.payload.scene==="object")?.payload?.scene;
    const beforeQuality=Number(generated?.payload?.quality);
    const afterQuality=Number(feedback?.payload?.quality??generated?.payload?.quality);
    rows.push({
      run_id:runId,batch_id:batchId,source:first.source||"visual-studio",
      skill:list.find(e=>e.skill)?.skill||null,
      engine_version:list.find(e=>e.engineVersion)?.engineVersion||null,
      input_hash:typeof generated?.payload?.input==="string"?hash(String(generated.payload.input)):null,
      initial_scene_hash:initialScene?hash(JSON.stringify(initialScene)):null,
      final_scene_hash:finalScene?hash(JSON.stringify(finalScene)):null,
      quality_before:Number.isFinite(beforeQuality)?beforeQuality:null,
      quality_after:Number.isFinite(afterQuality)?afterQuality:null,
      accepted:feedback?feedback.payload?.rating==="good":null,
      exported:!!exportEvent,event_count:list.length,
      metadata:{lastEventType:last.type,sceneId:last.sceneId||null},
      started_at:first.timestamp,completed_at:last.timestamp
    });
  }
  return rows;
}

export async function POST(request:NextRequest){
  if(!sameOriginOrIngestToken(request)){
    return NextResponse.json({error:"Unauthorized learning ingest origin"},{status:403});
  }
  let job:any=null;
  try{
    const raw=await request.text();
    if(raw.length>2_500_000)return NextResponse.json({error:"Learning batch exceeds 2.5 MB"},{status:413});
    const body=JSON.parse(raw||"{}");
    const events=Array.isArray(body.events)?body.events as CloudLearningEvent[]:[];
    if(!events.length)return NextResponse.json({error:"No events to sync"},{status:400});
    if(events.length>250)return NextResponse.json({error:"Maximum 250 events per batch"},{status:413});
    for(const event of events){
      if(!event?.id||!event?.timestamp||!event?.type)throw new Error("Invalid learning event");
    }

    const account=await getDriveAccount();
    if(!account||account.status==="disconnected")return NextResponse.json({error:"Google Drive is not connected"},{status:409});
    const eventsFolderId=account.folder_map?.events;
    if(!eventsFolderId)throw new Error("Drive events folder is missing");

    // Raw user content remains in IndexedDB. Cloud history receives redacted structure and hashes.
    const cloudEvents=events.map(sanitizeLearningEvent);
    const jsonl=cloudEvents.map(event=>JSON.stringify(event)).join("\n")+"\n";
    const sha256=hash(jsonl);
    const batchKey="events-"+sha256;
    const existing=await findBatchByKey(batchKey);
    if(existing){
      return NextResponse.json({ok:true,duplicate:true,batchId:existing.id,eventIds:events.map(e=>e.id)});
    }

    job=await createSyncJob({source:String(body.source||"visual-studio"),status:"running",event_count:events.length});
    const token=await refreshDriveAccessToken(decryptLearningSecret(account.refresh_token_ciphertext));

    const sceneArtifacts=extractSceneArtifacts(events);
    const sceneFolderId=account.folder_map?.scenes;
    const sceneRefs:string[]=[];
    if(sceneFolderId){
      for(const artifact of sceneArtifacts){
        const existingObject=await findLearningObject(artifact.sha256);
        if(existingObject){
          await touchLearningObject(artifact.sha256,Number(existingObject.reference_count||1)+1);
          sceneRefs.push(artifact.sha256);
          continue;
        }
        const sceneGz=gzipSync(Buffer.from(artifact.serialized,"utf8"),{level:9});
        const sceneName="scene-"+artifact.sha256.slice(0,20)+".json.gz";
        const uploadedScene=await uploadDriveFile({
          accessToken:token.access_token,name:sceneName,parentId:sceneFolderId,
          bytes:new Uint8Array(sceneGz),mimeType:"application/gzip",
          appProperties:{sha256:artifact.sha256,sceneId:artifact.sceneId,privacy:"structured-v1"}
        });
        await insertLearningObject({
          sha256:artifact.sha256,kind:"scene",provider:"google_drive",
          drive_file_id:uploadedScene.id,drive_folder_id:sceneFolderId,drive_path:"scenes/"+sceneName,
          mime_type:"application/gzip",size_bytes:sceneGz.byteLength,reference_count:1,
          metadata:{sceneId:artifact.sceneId,privacy:"structured-v1"}
        });
        sceneRefs.push(artifact.sha256);
      }
    }

    const gz=gzipSync(Buffer.from(jsonl,"utf8"),{level:9});
    const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    const name="events-"+stamp+"-"+sha256.slice(0,10)+".jsonl.gz";
    const uploaded=await uploadDriveFile({
      accessToken:token.access_token,name,parentId:eventsFolderId,bytes:new Uint8Array(gz),mimeType:"application/gzip",
      appProperties:{learningBatchKey:batchKey,sha256,eventCount:String(events.length),privacy:"structured-v1"}
    });
    const times=events.map(e=>new Date(e.timestamp).getTime()).filter(Number.isFinite);
    const batch=await insertBatch({
      batch_key:batchKey,provider:"google_drive",drive_file_id:uploaded.id,drive_folder_id:eventsFolderId,
      drive_path:"events/"+name,sha256,mime_type:"application/gzip",size_bytes:gz.byteLength,event_count:events.length,
      first_event_at:times.length?new Date(Math.min(...times)).toISOString():null,
      last_event_at:times.length?new Date(Math.max(...times)).toISOString():null,
      status:"synced",
      metadata:{source:body.source||"visual-studio",webViewLink:uploaded.webViewLink||null,privacy:"structured-v1",sceneRefs},
      synced_at:new Date().toISOString()
    });

    const runs=summarizeRuns(events,batch.id);
    if(runs.length)await upsertRuns(runs);
    const observations=extractLearningObservations(events);
    if(observations.length)await insertObservations(observations);

    const optimizer:any[]=[];
    const affectedSkills=[...new Set([
      ...observations.map(row=>String(row.skill||"")),
      ...events.map(event=>String(event.skill||""))
    ].filter(Boolean))];
    for(const skill of affectedSkills){
      try{optimizer.push({skill,...await scanSkillCandidate(skill)});}
      catch(error){optimizer.push({skill,created:false,reason:String(error)});}
    }

    await updateDriveAccount({status:"connected",last_sync_at:new Date().toISOString(),last_error:null});
    await updateSyncJob(job.id,{
      status:"success",batch_id:batch.id,completed_at:new Date().toISOString(),
      metadata:{observations:observations.length,sceneObjects:sceneRefs.length,optimizer}
    });
    return NextResponse.json({
      ok:true,batchId:batch.id,driveFileId:uploaded.id,eventIds:events.map(e=>e.id),
      sizeBytes:gz.byteLength,observations:observations.length,sceneObjects:sceneRefs.length,optimizer
    });
  }catch(error){
    const message=String(error).slice(0,1000);
    if(job?.id)try{await updateSyncJob(job.id,{status:"error",error:message,completed_at:new Date().toISOString()});}catch{}
    try{await updateDriveAccount({status:"error",last_error:message});}catch{}
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}
