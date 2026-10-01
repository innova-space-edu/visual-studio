import {NextRequest,NextResponse} from "next/server";
import {VisualExperimentEngine} from "@innova-space/visual-engine";
import {experimentReward} from "@innova-space/visual-design/runtime";
import {requireLearningAdmin} from "@/lib/server/learning-auth";
import {
  findCandidateById,findExperiment,getDriveAccount,getLearningIntelligenceDashboard,
  insertExperiment,insertExperimentOutcome,insertRelease,listExperimentOutcomes,
  updateCandidate,updateExperiment,updateRelease
} from "@/lib/server/learning-db";
import {runCandidateRegression,scanAllCandidates,scanSkillCandidate} from "@/lib/server/learning-intelligence";

export const runtime="nodejs";
export const maxDuration=60;

async function admin(){
  const account=await getDriveAccount();
  await requireLearningAdmin(account);
  return account;
}

function armIds(arms:any){
  if(!Array.isArray(arms))return [];
  return arms.map((arm:any)=>typeof arm==="string"?arm:String(arm?.id||"")).filter(Boolean);
}

async function experimentState(experiment:any){
  const ids=armIds(experiment.arms);
  const engine=new VisualExperimentEngine({id:experiment.experiment_key,arms:ids,minSamplesPerArm:experiment.min_samples_per_arm||20});
  const outcomes=await listExperimentOutcomes(experiment.id,10000);
  for(const row of outcomes){
    if(ids.includes(String(row.arm)))engine.record(String(row.arm),{success:row.accepted===true,reward:Number(row.reward)});
  }
  return {engine,outcomes,result:engine.result()};
}

export async function GET(){
  try{
    await admin();
    return NextResponse.json({ok:true,...await getLearningIntelligenceDashboard()},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return NextResponse.json({ok:false,error:String(error)},{status:403,headers:{"Cache-Control":"no-store"}});
  }
}

export async function POST(request:NextRequest){
  try{
    await admin();
    const body=await request.json();
    const action=String(body?.action||"");

    if(action==="scan"){
      const result=body.skill?await scanSkillCandidate(String(body.skill),{
        minSamples:Number(body.minSamples)||20,minConfidence:Number(body.minConfidence)||.62,currentVersion:body.currentVersion?String(body.currentVersion):undefined
      }):await scanAllCandidates();
      return NextResponse.json({ok:true,result});
    }

    if(action==="regress"){
      if(!body.candidateId)throw new Error("candidateId is required");
      return NextResponse.json({ok:true,result:await runCandidateRegression(String(body.candidateId))});
    }

    if(action==="candidate-status"){
      const candidate=await findCandidateById(String(body.candidateId||""));
      if(!candidate)throw new Error("Candidate not found");
      const next=String(body.status||"");
      const allowed=
        (candidate.status==="recommended"&&["approved","rejected"].includes(next))||
        (candidate.status==="candidate"&&next==="rejected");
      if(!allowed)throw new Error("Invalid candidate transition: "+candidate.status+" -> "+next);
      const now=new Date().toISOString();
      const patch:any={status:next,review_note:body.note?String(body.note).slice(0,1000):null};
      if(next==="approved")patch.approved_at=now;
      if(next==="rejected")patch.rejected_at=now;
      return NextResponse.json({ok:true,result:await updateCandidate(candidate.id,patch)});
    }

    if(action==="experiment-create"){
      const ids=armIds(body.arms);
      if(ids.length<2)throw new Error("At least two experiment arms are required");
      const key=String(body.experimentKey||"").trim();
      if(!key)throw new Error("experimentKey is required");
      const row=await insertExperiment({
        experiment_key:key,
        skill:body.skill?String(body.skill):null,
        status:"running",
        arms:Array.isArray(body.arms)?body.arms:ids,
        min_samples_per_arm:Math.max(2,Number(body.minSamples)||20),
        config:body.config&&typeof body.config==="object"?body.config:{},
        started_at:new Date().toISOString()
      });
      return NextResponse.json({ok:true,result:row});
    }

    if(action==="experiment-choose"){
      const experiment=await findExperiment(String(body.experimentId||""));
      if(!experiment)throw new Error("Experiment not found");
      const state=await experimentState(experiment);
      return NextResponse.json({ok:true,arm:state.engine.chooseArm(),result:state.result});
    }

    if(action==="experiment-record"){
      const experiment=await findExperiment(String(body.experimentId||""));
      if(!experiment)throw new Error("Experiment not found");
      const ids=armIds(experiment.arms);
      const arm=String(body.arm||"");
      if(!ids.includes(arm))throw new Error("Unknown experiment arm");
      const reward=experimentReward({
        accepted:body.accepted===true?true:body.accepted===false?false:undefined,
        exported:!!body.exported,
        quality:Number(body.quality)||0,
        edits:Number(body.edits)||0
      });
      await insertExperimentOutcome({
        experiment_id:experiment.id,run_id:body.runId?String(body.runId):null,arm,reward,
        accepted:body.accepted==null?null:!!body.accepted,exported:!!body.exported,
        quality:Number.isFinite(Number(body.quality))?Number(body.quality):null,
        edits:Number.isFinite(Number(body.edits))?Math.max(0,Math.round(Number(body.edits))):null,
        metadata:body.metadata&&typeof body.metadata==="object"?body.metadata:{}
      });
      const state=await experimentState(experiment);
      const patch:any={confidence:state.result.confidence};
      if(state.result.winner){
        patch.status="completed";patch.winner=state.result.winner;patch.completed_at=new Date().toISOString();
      }
      await updateExperiment(experiment.id,patch);
      return NextResponse.json({ok:true,reward,result:state.result});
    }

    if(action==="experiment-cancel"){
      const experiment=await findExperiment(String(body.experimentId||""));
      if(!experiment)throw new Error("Experiment not found");
      return NextResponse.json({ok:true,result:await updateExperiment(experiment.id,{status:"cancelled",completed_at:new Date().toISOString()})});
    }

    if(action==="release-create"){
      const ids=Array.isArray(body.candidateIds)?body.candidateIds.map(String):[];
      if(!ids.length)throw new Error("candidateIds are required");
      const candidates=await Promise.all(ids.map(findCandidateById));
      if(candidates.some(c=>!c||c.status!=="approved"))throw new Error("All candidates must be approved before scheduling a release");
      const scheduled=new Date(body.scheduledFor||Date.now()+2*24*60*60*1000);
      if(!Number.isFinite(scheduled.getTime()))throw new Error("Invalid scheduledFor");
      const notifyAt=new Date(scheduled.getTime()-2*24*60*60*1000);
      const version=String(body.version||("visual-learning-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+Date.now().toString(36)));
      const row=await insertRelease({
        version,status:"scheduled",candidate_ids:ids,scheduled_for:scheduled.toISOString(),notify_at:notifyAt.toISOString(),
        manifest:{candidateKeys:candidates.map(c=>c.candidate_key),createdBy:"visual-studio"}
      });
      return NextResponse.json({ok:true,result:row});
    }

    if(action==="release-approve"){
      if(!body.releaseId)throw new Error("releaseId is required");
      return NextResponse.json({ok:true,result:await updateRelease(String(body.releaseId),{status:"approved"})});
    }

    throw new Error("Unknown action: "+action);
  }catch(error){
    return NextResponse.json({ok:false,error:String(error)},{status:400});
  }
}
