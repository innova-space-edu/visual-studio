import type { VisualDocument, VisualScene } from "@innova-space/visual-engine";

const DB_NAME="innova-visual-studio";
const DB_VERSION=4;
const DOCS="documents";
const EVALS="evaluations";
const LEARNING="learning";
const VERSIONS="versions";
const OUTBOX="learning-outbox";

function openDb():Promise<IDBDatabase>{
  return new Promise(function(resolve,reject){
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=function(){
      const db=request.result;
      if(!db.objectStoreNames.contains(DOCS)){
        const docs=db.createObjectStore(DOCS,{keyPath:"id"});
        docs.createIndex("updatedAt","updatedAt");
      }
      if(!db.objectStoreNames.contains(LEARNING)){
        db.createObjectStore(LEARNING,{keyPath:"id"});
      }
      if(!db.objectStoreNames.contains(EVALS)){
        const evals=db.createObjectStore(EVALS,{keyPath:"id"});
        evals.createIndex("createdAt","createdAt");
        evals.createIndex("sceneId","sceneId");
      }
      if(!db.objectStoreNames.contains(VERSIONS)){
        const versions=db.createObjectStore(VERSIONS,{keyPath:"id"});
        versions.createIndex("sceneId","sceneId");
        versions.createIndex("createdAt","createdAt");
      }
      if(!db.objectStoreNames.contains(OUTBOX)){
        const outbox=db.createObjectStore(OUTBOX,{keyPath:"id"});
        outbox.createIndex("status","status");
        outbox.createIndex("createdAt","createdAt");
      }
    };
    request.onsuccess=function(){resolve(request.result);};
    request.onerror=function(){reject(request.error);};
  });
}

function transactionPromise<T>(tx:IDBTransaction,request:IDBRequest<T>):Promise<T>{
  return new Promise(function(resolve,reject){
    request.onsuccess=function(){resolve(request.result);};
    request.onerror=function(){reject(request.error);};
    tx.onerror=function(){reject(tx.error);};
  });
}

export async function saveLocalScene(scene:VisualScene){
  const db=await openDb();
  const tx=db.transaction(DOCS,"readwrite");
  const payload={id:scene.id,scene:scene,updatedAt:Date.now()};
  await transactionPromise(tx,tx.objectStore(DOCS).put(payload));
  db.close();
  return payload;
}

export async function loadLocalScene(id:string):Promise<VisualScene|null>{
  const db=await openDb();
  const tx=db.transaction(DOCS,"readonly");
  const value:any=await transactionPromise(tx,tx.objectStore(DOCS).get(id));
  db.close();
  return value&&value.scene?value.scene:null;
}

export async function loadLatestScene():Promise<VisualScene|null>{
  const db=await openDb();
  const tx=db.transaction(DOCS,"readonly");
  const store=tx.objectStore(DOCS);
  const request=store.getAll();
  const rows:any[]=await transactionPromise(tx,request);
  db.close();
  rows.sort(function(a,b){return Number(b.updatedAt||0)-Number(a.updatedAt||0);});
  return rows[0]&&rows[0].scene?rows[0].scene:null;
}

export async function recordEvaluation(input:{
  scene:VisualScene;
  rating:"good"|"needs-work";
  quality:number;
  diagnostics:unknown[];
  note?:string;
}){
  const db=await openDb();
  const tx=db.transaction(EVALS,"readwrite");
  const payload={
    id:input.scene.id+":"+Date.now()+":"+Math.random().toString(36).slice(2,8),
    sceneId:input.scene.id,
    scene:input.scene,
    rating:input.rating,
    quality:input.quality,
    diagnostics:input.diagnostics,
    note:input.note||"",
    createdAt:Date.now(),
    schema:"visual-feedback/1.0"
  };
  await transactionPromise(tx,tx.objectStore(EVALS).put(payload));
  db.close();
  return payload;
}

export async function exportEvaluations(){
  const db=await openDb();
  const tx=db.transaction(EVALS,"readonly");
  const rows:any[]=await transactionPromise(tx,tx.objectStore(EVALS).getAll());
  db.close();
  return {
    schema:"visual-feedback-export/1.0",
    exportedAt:new Date().toISOString(),
    evaluations:rows
  };
}


export async function saveLearningSnapshot(snapshot:unknown,key="default"){
  const db=await openDb();
  const tx=db.transaction(LEARNING,"readwrite");
  const payload={id:key,snapshot,updatedAt:Date.now()};
  await transactionPromise(tx,tx.objectStore(LEARNING).put(payload));
  db.close();
  return payload;
}

export async function loadLearningSnapshot<T=unknown>(key="default"):Promise<T|null>{
  const db=await openDb();
  const tx=db.transaction(LEARNING,"readonly");
  const value:any=await transactionPromise(tx,tx.objectStore(LEARNING).get(key));
  db.close();
  return value?.snapshot??null;
}


export async function saveVisualDocument(document:VisualDocument){
  const db=await openDb();
  const tx=db.transaction(DOCS,"readwrite");
  const payload={id:"document:"+document.id,document,updatedAt:Date.now(),kind:"visual-document"};
  await transactionPromise(tx,tx.objectStore(DOCS).put(payload));
  db.close();
  return payload;
}

export async function loadVisualDocument(id:string):Promise<VisualDocument|null>{
  const db=await openDb();
  const tx=db.transaction(DOCS,"readonly");
  const value:any=await transactionPromise(tx,tx.objectStore(DOCS).get("document:"+id));
  db.close();
  return value?.document??null;
}

export async function loadLatestVisualDocument():Promise<VisualDocument|null>{
  const db=await openDb();
  const tx=db.transaction(DOCS,"readonly");
  const rows:any[]=await transactionPromise(tx,tx.objectStore(DOCS).getAll());
  db.close();
  return rows.filter(row=>row.kind==="visual-document"&&row.document)
    .sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0]?.document??null;
}

export async function recordSceneVersion(scene:VisualScene,label="edit"){
  const db=await openDb();
  const tx=db.transaction(VERSIONS,"readwrite");
  const createdAt=Date.now();
  const payload={
    id:scene.id+":"+createdAt+":"+Math.random().toString(36).slice(2,7),
    sceneId:scene.id,label,scene:structuredClone(scene),createdAt
  };
  await transactionPromise(tx,tx.objectStore(VERSIONS).put(payload));
  db.close();
  return payload;
}

export async function listSceneVersions(sceneId:string,limit=30){
  const db=await openDb();
  const tx=db.transaction(VERSIONS,"readonly");
  const rows:any[]=await transactionPromise(tx,tx.objectStore(VERSIONS).index("sceneId").getAll(sceneId));
  db.close();
  return rows.sort((a,b)=>Number(b.createdAt)-Number(a.createdAt)).slice(0,Math.max(1,limit));
}


export interface LearningEventInput {
  type:string;
  source?:string;
  runId?:string|null;
  sceneId?:string|null;
  skill?:string|null;
  engineVersion?:string|null;
  payload?:Record<string,unknown>;
}

export interface LearningOutboxEvent extends LearningEventInput {
  id:string;
  timestamp:string;
  createdAt:number;
  status:"pending"|"synced";
  attempts:number;
  lastAttemptAt?:number;
  lastError?:string;
  batchId?:string;
}

export async function enqueueLearningEvent(input:LearningEventInput){
  const event:LearningOutboxEvent={
    ...input,
    id:crypto.randomUUID(),
    timestamp:new Date().toISOString(),
    createdAt:Date.now(),
    status:"pending",
    attempts:0
  };
  const db=await openDb();
  const tx=db.transaction(OUTBOX,"readwrite");
  await transactionPromise(tx,tx.objectStore(OUTBOX).put(event));
  db.close();
  void maybeSyncLearningOutbox();
  return event;
}

export async function getPendingLearningEvents(limit=250){
  const db=await openDb();
  const tx=db.transaction(OUTBOX,"readonly");
  const rows:any[]=await transactionPromise(tx,tx.objectStore(OUTBOX).index("status").getAll("pending"));
  db.close();
  rows.sort((a,b)=>Number(a.createdAt)-Number(b.createdAt));
  const selected:LearningOutboxEvent[]=[];
  let size=0;
  for(const row of rows){
    const estimate=JSON.stringify(row).length+1;
    if(selected.length&&size+estimate>2_000_000)break;
    selected.push(row);size+=estimate;
    if(selected.length>=limit)break;
  }
  return selected;
}

async function patchLearningEvents(ids:string[],patch:Record<string,unknown>){
  if(!ids.length)return;
  const db=await openDb();
  const tx=db.transaction(OUTBOX,"readwrite");
  const store=tx.objectStore(OUTBOX);
  for(const id of ids){
    const row:any=await transactionPromise(tx,store.get(id));
    if(row)await transactionPromise(tx,store.put({...row,...patch}));
  }
  db.close();
}

export async function markLearningEventsSynced(ids:string[],batchId:string){
  await patchLearningEvents(ids,{status:"synced",batchId,lastError:undefined,lastAttemptAt:Date.now()});
}

export async function markLearningEventsAttempt(ids:string[],error:string){
  const db=await openDb();
  const tx=db.transaction(OUTBOX,"readwrite");
  const store=tx.objectStore(OUTBOX);
  for(const id of ids){
    const row:any=await transactionPromise(tx,store.get(id));
    if(row)await transactionPromise(tx,store.put({...row,attempts:Number(row.attempts||0)+1,lastAttemptAt:Date.now(),lastError:error.slice(0,500)}));
  }
  db.close();
}

export async function getLearningOutboxStats(){
  const db=await openDb();
  const tx=db.transaction(OUTBOX,"readonly");
  const rows:any[]=await transactionPromise(tx,tx.objectStore(OUTBOX).getAll());
  db.close();
  const pending=rows.filter(row=>row.status==="pending");
  const synced=rows.filter(row=>row.status==="synced");
  return {
    pending:pending.length,
    synced:synced.length,
    total:rows.length,
    oldestPendingAt:pending.length?Math.min(...pending.map(row=>Number(row.createdAt||Date.now()))):null,
    failed:pending.filter(row=>row.lastError).length
  };
}

export async function pruneSyncedLearningEvents(olderThanMs=7*24*60*60*1000){
  const cutoff=Date.now()-olderThanMs;
  const db=await openDb();
  const tx=db.transaction(OUTBOX,"readwrite");
  const store=tx.objectStore(OUTBOX);
  const rows:any[]=await transactionPromise(tx,store.getAll());
  for(const row of rows){
    if(row.status==="synced"&&Number(row.createdAt)<cutoff)store.delete(row.id);
  }
  db.close();
}

let syncInFlight:Promise<any>|null=null;

export async function syncLearningOutbox(force=false){
  if(typeof window==="undefined")return {ok:false,reason:"server"};
  if(syncInFlight)return syncInFlight;
  syncInFlight=(async()=>{
    const pending=await getPendingLearningEvents(250);
    if(!pending.length)return {ok:true,synced:0};
    const oldest=Math.min(...pending.map(event=>event.createdAt));
    if(!force&&pending.length<50&&Date.now()-oldest<15*60*1000)return {ok:true,deferred:true,pending:pending.length};
    if(typeof navigator!=="undefined"&&!navigator.onLine)return {ok:false,offline:true,pending:pending.length};
    try{
      const res=await fetch("/api/learning/sync",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({source:"visual-studio",events:pending})
      });
      const payload=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(payload?.error||("Learning sync "+res.status));
      const ids=Array.isArray(payload.eventIds)?payload.eventIds:pending.map(event=>event.id);
      await markLearningEventsSynced(ids,String(payload.batchId||""));
      await pruneSyncedLearningEvents();
      try{localStorage.setItem("visual-learning-last-sync",String(Date.now()));}catch{}
      return {ok:true,synced:ids.length,batchId:payload.batchId};
    }catch(error){
      await markLearningEventsAttempt(pending.map(event=>event.id),String(error));
      return {ok:false,error:String(error),pending:pending.length};
    }
  })();
  try{return await syncInFlight;}finally{syncInFlight=null;}
}

export function installLearningAutoSync(){
  if(typeof window==="undefined")return ()=>{};
  const run=()=>{void syncLearningOutbox(false);};
  const timer=window.setInterval(run,15*60*1000);
  window.addEventListener("online",run);
  const visibility=()=>{if(document.visibilityState==="visible")run();};
  document.addEventListener("visibilitychange",visibility);
  window.setTimeout(run,3000);
  return ()=>{
    window.clearInterval(timer);
    window.removeEventListener("online",run);
    document.removeEventListener("visibilitychange",visibility);
  };
}
