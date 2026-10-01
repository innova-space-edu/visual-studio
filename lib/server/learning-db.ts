import {requireLearningEnv} from "./learning-env";

export interface LearningStorageAccount{
  id:string;
  provider:"google_drive";
  account_email:string|null;
  account_name:string|null;
  refresh_token_ciphertext:string;
  root_folder_id:string|null;
  folder_map:Record<string,string>;
  scopes:string[];
  status:"connected"|"error"|"disconnected";
  connected_at:string;
  last_sync_at:string|null;
  last_error:string|null;
  metadata:Record<string,unknown>;
  updated_at:string;
}

async function rest(path:string,init:RequestInit={}){
  const env=requireLearningEnv();
  const headers=new Headers(init.headers);
  headers.set("apikey",env.supabaseServiceKey);
  headers.set("Authorization","Bearer "+env.supabaseServiceKey);
  if(init.body&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");
  const res=await fetch(env.supabaseUrl+"/rest/v1/"+path,{...init,headers,cache:"no-store"});
  const body=await res.text();
  if(!res.ok)throw new Error("Learning Supabase "+res.status+": "+body.slice(0,1000));
  if(!body)return {data:null,headers:res.headers};
  return {data:JSON.parse(body),headers:res.headers};
}

export async function getDriveAccount():Promise<LearningStorageAccount|null>{
  const {data}=await rest("learning_storage_accounts?provider=eq.google_drive&select=*&limit=1");
  return Array.isArray(data)&&data[0]?data[0]:null;
}

export async function upsertDriveAccount(row:Record<string,unknown>){
  const {data}=await rest("learning_storage_accounts?on_conflict=provider",{
    method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=representation"},
    body:JSON.stringify(row)
  });
  return Array.isArray(data)?data[0]:data;
}

export async function updateDriveAccount(patch:Record<string,unknown>){
  const {data}=await rest("learning_storage_accounts?provider=eq.google_drive",{
    method:"PATCH",
    headers:{Prefer:"return=representation"},
    body:JSON.stringify({...patch,updated_at:new Date().toISOString()})
  });
  return Array.isArray(data)?data[0]:data;
}

export async function findBatchByKey(batchKey:string){
  const {data}=await rest("learning_batches?batch_key=eq."+encodeURIComponent(batchKey)+"&select=*&limit=1");
  return Array.isArray(data)&&data[0]?data[0]:null;
}

export async function insertBatch(row:Record<string,unknown>){
  const {data}=await rest("learning_batches",{
    method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)
  });
  return Array.isArray(data)?data[0]:data;
}

export async function createSyncJob(row:Record<string,unknown>){
  const {data}=await rest("learning_sync_jobs",{
    method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)
  });
  return Array.isArray(data)?data[0]:data;
}

export async function updateSyncJob(id:string,patch:Record<string,unknown>){
  const {data}=await rest("learning_sync_jobs?id=eq."+encodeURIComponent(id),{
    method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(patch)
  });
  return Array.isArray(data)?data[0]:data;
}

export async function upsertRuns(rows:Record<string,unknown>[]){
  if(!rows.length)return [];
  const {data}=await rest("learning_runs?on_conflict=run_id",{
    method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=representation"},
    body:JSON.stringify(rows)
  });
  return data||[];
}

function totalFromRange(value:string|null){
  if(!value)return 0;
  const tail=value.split("/").pop();
  return tail&&tail!=="*"?Number(tail)||0:0;
}

async function count(table:string){
  const env=requireLearningEnv();
  const res=await fetch(env.supabaseUrl+"/rest/v1/"+table+"?select=id&limit=1",{
    method:"GET",cache:"no-store",
    headers:{
      apikey:env.supabaseServiceKey,
      Authorization:"Bearer "+env.supabaseServiceKey,
      Prefer:"count=exact"
    }
  });
  if(!res.ok)throw new Error("Learning Supabase count "+res.status);
  return totalFromRange(res.headers.get("content-range"));
}

export async function getLearningCloudSummary(){
  const [batches,runs,jobs]=await Promise.all([count("learning_batches"),count("learning_runs"),count("learning_sync_jobs")]);
  return {batches,runs,jobs};
}
