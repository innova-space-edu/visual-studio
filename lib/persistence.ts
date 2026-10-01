import type { VisualDocument, VisualScene } from "@innova-space/visual-engine";

const DB_NAME="innova-visual-studio";
const DB_VERSION=3;
const DOCS="documents";
const EVALS="evaluations";
const LEARNING="learning";
const VERSIONS="versions";

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
