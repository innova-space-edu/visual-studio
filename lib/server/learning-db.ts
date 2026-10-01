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
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)
  });
  return Array.isArray(data)?data[0]:data;
}

export async function updateDriveAccount(patch:Record<string,unknown>){
  const {data}=await rest("learning_storage_accounts?provider=eq.google_drive",{
    method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({...patch,updated_at:new Date().toISOString()})
  });
  return Array.isArray(data)?data[0]:data;
}

export async function findBatchByKey(batchKey:string){
  const {data}=await rest("learning_batches?batch_key=eq."+encodeURIComponent(batchKey)+"&select=*&limit=1");
  return Array.isArray(data)&&data[0]?data[0]:null;
}

export async function insertBatch(row:Record<string,unknown>){
  const {data}=await rest("learning_batches",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});
  return Array.isArray(data)?data[0]:data;
}

export async function createSyncJob(row:Record<string,unknown>){
  const {data}=await rest("learning_sync_jobs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});
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
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(rows)
  });
  return data||[];
}

export async function insertObservations(rows:Record<string,unknown>[]){
  if(!rows.length)return [];
  const {data}=await rest("learning_observations",{
    method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(rows)
  });
  return data||[];
}

export async function findLearningObject(sha256:string){
  const {data}=await rest("learning_objects?sha256=eq."+encodeURIComponent(sha256)+"&select=*&limit=1");
  return Array.isArray(data)&&data[0]?data[0]:null;
}

export async function insertLearningObject(row:Record<string,unknown>){
  const {data}=await rest("learning_objects?on_conflict=sha256",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)
  });
  return Array.isArray(data)?data[0]:data;
}

export async function touchLearningObject(sha256:string,referenceCount:number){
  const {data}=await rest("learning_objects?sha256=eq."+encodeURIComponent(sha256),{
    method:"PATCH",headers:{Prefer:"return=representation"},
    body:JSON.stringify({reference_count:referenceCount,last_referenced_at:new Date().toISOString()})
  });
  return Array.isArray(data)?data[0]:data;
}

export async function listRuns(limit=100){
  const {data}=await rest("learning_runs?select=*&order=created_at.desc&limit="+Math.max(1,Math.min(1000,limit)));
  return Array.isArray(data)?data:[];
}

export async function listObservations(options:{skill?:string;limit?:number}={}){
  const parts=["select=*","order=occurred_at.desc","limit="+Math.max(1,Math.min(10000,options.limit??2000))];
  if(options.skill)parts.push("skill=eq."+encodeURIComponent(options.skill));
  const {data}=await rest("learning_observations?"+parts.join("&"));
  return Array.isArray(data)?data:[];
}

export async function listCandidates(limit=100){
  const {data}=await rest("learning_candidates?select=*&order=created_at.desc&limit="+Math.max(1,Math.min(500,limit)));
  return Array.isArray(data)?data:[];
}

export async function findCandidateByKey(key:string){
  const {data}=await rest("learning_candidates?candidate_key=eq."+encodeURIComponent(key)+"&select=*&limit=1");
  return Array.isArray(data)&&data[0]?data[0]:null;
}

export async function findCandidateById(id:string){
  const {data}=await rest("learning_candidates?id=eq."+encodeURIComponent(id)+"&select=*&limit=1");
  return Array.isArray(data)&&data[0]?data[0]:null;
}

export async function insertCandidate(row:Record<string,unknown>){
  const {data}=await rest("learning_candidates?on_conflict=candidate_key",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)
  });
  return Array.isArray(data)?data[0]:data;
}

export async function updateCandidate(id:string,patch:Record<string,unknown>){
  const {data}=await rest("learning_candidates?id=eq."+encodeURIComponent(id),{
    method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({...patch,updated_at:new Date().toISOString()})
  });
  return Array.isArray(data)?data[0]:data;
}

export async function insertRegressionRun(row:Record<string,unknown>){
  const {data}=await rest("learning_regression_runs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});
  return Array.isArray(data)?data[0]:data;
}

export async function listRegressionRuns(limit=100){
  const {data}=await rest("learning_regression_runs?select=*&order=created_at.desc&limit="+Math.max(1,Math.min(500,limit)));
  return Array.isArray(data)?data:[];
}

export async function listExperiments(limit=100){
  const {data}=await rest("learning_experiments?select=*&order=created_at.desc&limit="+Math.max(1,Math.min(500,limit)));
  return Array.isArray(data)?data:[];
}

export async function findExperiment(id:string){
  const {data}=await rest("learning_experiments?id=eq."+encodeURIComponent(id)+"&select=*&limit=1");
  return Array.isArray(data)&&data[0]?data[0]:null;
}

export async function insertExperiment(row:Record<string,unknown>){
  const {data}=await rest("learning_experiments?on_conflict=experiment_key",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)
  });
  return Array.isArray(data)?data[0]:data;
}

export async function updateExperiment(id:string,patch:Record<string,unknown>){
  const {data}=await rest("learning_experiments?id=eq."+encodeURIComponent(id),{
    method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({...patch,updated_at:new Date().toISOString()})
  });
  return Array.isArray(data)?data[0]:data;
}

export async function insertExperimentOutcome(row:Record<string,unknown>){
  const {data}=await rest("learning_experiment_outcomes",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});
  return Array.isArray(data)?data[0]:data;
}

export async function listExperimentOutcomes(experimentId:string,limit=5000){
  const {data}=await rest("learning_experiment_outcomes?experiment_id=eq."+encodeURIComponent(experimentId)+"&select=*&order=occurred_at.asc&limit="+Math.max(1,Math.min(10000,limit)));
  return Array.isArray(data)?data:[];
}

export async function listReleases(limit=100){
  const {data}=await rest("learning_releases?select=*&order=created_at.desc&limit="+Math.max(1,Math.min(500,limit)));
  return Array.isArray(data)?data:[];
}

export async function insertRelease(row:Record<string,unknown>){
  const {data}=await rest("learning_releases?on_conflict=version",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)
  });
  return Array.isArray(data)?data[0]:data;
}

export async function updateRelease(id:string,patch:Record<string,unknown>){
  const {data}=await rest("learning_releases?id=eq."+encodeURIComponent(id),{
    method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(patch)
  });
  return Array.isArray(data)?data[0]:data;
}

function totalFromRange(value:string|null){
  if(!value)return 0;
  const tail=value.split("/").pop();
  return tail&&tail!=="*"?Number(tail)||0:0;
}

async function count(table:string){
  const env=requireLearningEnv();
  const res=await fetch(env.supabaseUrl+"/rest/v1/"+table+"?select=*&limit=1",{
    method:"GET",cache:"no-store",
    headers:{apikey:env.supabaseServiceKey,Authorization:"Bearer "+env.supabaseServiceKey,Prefer:"count=exact"}
  });
  if(!res.ok){
    const body=await res.text().catch(()=>"");
    throw new Error("Learning Supabase count "+table+" "+res.status+": "+body.slice(0,300));
  }
  return totalFromRange(res.headers.get("content-range"));
}

export async function getLearningCloudSummary(){
  const [batches,runs,jobs,observations,candidates,experiments,regressions]=await Promise.all([
    count("learning_batches"),count("learning_runs"),count("learning_sync_jobs"),count("learning_observations"),
    count("learning_candidates"),count("learning_experiments"),count("learning_regression_runs")
  ]);
  return {batches,runs,jobs,observations,candidates,experiments,regressions};
}

export async function getLearningIntelligenceDashboard(){
  const [runs,observations,candidates,regressions,experiments,releases]=await Promise.all([
    listRuns(150),listObservations({limit:500}),listCandidates(150),listRegressionRuns(150),listExperiments(100),listReleases(100)
  ]);
  return {runs,observations,candidates,regressions,experiments,releases};
}
