import {
  analyzeAdvancedQuality,
  createOptimizationCandidate,
  renderSvg,
  runRegressionSuite,
  type ParameterObservation,
  type VisualNode,
  type VisualScene
} from "@innova-space/visual-engine";
import {compileStudioPrompt} from "@/lib/studio-compiler";
import {archiveLearningJson} from "./learning-archive";
import {analyzeStudioQuality} from "@/lib/studio-quality";
import {goldenCasesForSkill,goldenPlan,type GoldenVisualCase} from "@/lib/learning/golden-cases";
import {
  findCandidateByKey,findCandidateById,insertCandidate,insertRegressionRun,
  listObservations,listRuns,updateCandidate
} from "./learning-db";

function candidateVersion(){
  return "learn-"+new Date().toISOString().slice(0,16).replace(/[-:T]/g,"");
}

function toObservation(row:any,run?:any):ParameterObservation|null{
  const before=Number(row.before_value),after=Number(row.after_value);
  if(!Number.isFinite(before)||!Number.isFinite(after)||!row.skill||!row.feature)return null;
  return {
    skill:String(row.skill),
    nodeType:String(row.node_type||"*"),
    path:String(row.feature),
    before,after,
    qualityBefore:Number.isFinite(Number(row.quality_before))?Number(row.quality_before):(Number.isFinite(Number(run?.quality_before))?Number(run.quality_before):undefined),
    qualityAfter:Number.isFinite(Number(row.quality_after))?Number(row.quality_after):(Number.isFinite(Number(run?.quality_after))?Number(run.quality_after):undefined),
    accepted:row.accepted==null?(run?.accepted==null?undefined:!!run.accepted):!!row.accepted,
    exported:row.exported===true||run?.exported===true,
    timestamp:row.occurred_at?new Date(row.occurred_at).getTime():undefined
  };
}

function setPath(target:any,path:string,value:number){
  const parts=path.split(".").filter(Boolean);
  if(!parts.length)return false;
  let cursor=target;
  for(let i=0;i<parts.length-1;i++){
    const key=parts[i]!;
    if(!cursor[key]||typeof cursor[key]!=="object")cursor[key]={};
    cursor=cursor[key];
  }
  cursor[parts[parts.length-1]!]=value;
  return true;
}

function walk(nodes:VisualNode[],fn:(node:VisualNode)=>void){
  for(const node of nodes){
    fn(node);
    if(node.type==="group")walk(node.children,fn);
  }
}

export function applyCandidateChanges(scene:VisualScene,proposal:any){
  const next=structuredClone(scene);
  let applied=0;
  const entries=Object.entries(proposal?.changes||{}) as Array<[string,any]>;
  for(const [key,change] of entries){
    const split=key.indexOf(".");
    if(split<0)continue;
    const selector=key.slice(0,split);
    const path=key.slice(split+1);
    const hash=selector.indexOf("#");
    const type=hash>=0?selector.slice(0,hash):selector;
    const id=hash>=0?selector.slice(hash+1):null;
    walk(next.nodes,node=>{
      if(node.type!==type)return;
      if(id&&node.id!==id)return;
      if(setPath(node,path,Number(change?.value))){applied++;}
    });
  }
  return {scene:next,applied};
}

function compileGolden(test:GoldenVisualCase){
  return compileStudioPrompt(test.prompt,goldenPlan(test) as any);
}

function metrics(scene:VisualScene,prompt:string,failures=0){
  const started=performance.now();
  renderSvg(scene);
  const renderMs=performance.now()-started;
  const studio=analyzeStudioQuality(scene,prompt);
  const advanced=analyzeAdvancedQuality(scene);
  return {
    quality:studio.score,
    semantic:studio.semanticScore,
    overflow:studio.metrics.outOfBounds,
    edits:0,
    renderMs,
    failures:failures+advanced.diagnostics.filter(d=>d.level==="error").length
  };
}

export async function runCandidateRegression(candidateOrId:any){
  const candidate=typeof candidateOrId==="string"?await findCandidateById(candidateOrId):candidateOrId;
  if(!candidate)throw new Error("Candidate not found");
  const proposal=candidate.proposal||{};
  const cases=goldenCasesForSkill(String(candidate.skill));
  const report=await runRegressionSuite(
    cases.map(test=>({id:test.id,input:test})),
    test=>{
      try{
        const scene=compileGolden(test.input);
        return metrics(scene,test.input.prompt,0);
      }catch{return {quality:0,semantic:0,overflow:0,edits:0,renderMs:0,failures:1};}
    },
    test=>{
      try{
        const current=compileGolden(test.input);
        const changed=applyCandidateChanges(current,proposal);
        return metrics(changed.scene,test.input.prompt,changed.applied>0?0:1);
      }catch{return {quality:0,semantic:0,overflow:0,edits:0,renderMs:0,failures:1};}
    },
    {qualityDrop:.5,semanticDrop:.5,overflowIncrease:0,failureIncrease:0,renderSlowdownPct:25}
  );

  const archived=await archiveLearningJson({
    kind:"regression",folder:"regression",prefix:"regression",
    payload:report,metadata:{candidateId:candidate.id,skill:candidate.skill}
  });
  const row=await insertRegressionRun({
    candidate_id:candidate.id,
    status:report.passed?"passed":"failed",
    cases:report.cases,
    passed_cases:report.passedCases,
    failed_cases:report.failedCases,
    current_metrics:report.currentAverage,
    candidate_metrics:report.candidateAverage,
    delta_metrics:report.deltaAverage,
    report,
    drive_file_id:archived.fileId,
    completed_at:new Date().toISOString()
  });
  const patch:any={regression:report};
  if(report.passed&&candidate.status==="candidate"){
    patch.status="recommended";
    patch.recommended_at=new Date().toISOString();
  }
  await updateCandidate(candidate.id,patch);
  return {candidate:{...candidate,...patch},regression:row,report};
}

export async function scanSkillCandidate(skill:string,options:{minSamples?:number;minConfidence?:number;currentVersion?:string}={}){
  const [rows,runs]=await Promise.all([listObservations({skill,limit:10000}),listRuns(5000)]);
  const runMap=new Map(runs.map((run:any)=>[String(run.run_id),run]));
  const observations=rows.map((row:any)=>toObservation(row,runMap.get(String(row.run_id||"")))).filter((row):row is ParameterObservation=>!!row);
  const candidate=createOptimizationCandidate({
    skill,observations,
    currentVersion:options.currentVersion,
    candidateVersion:candidateVersion(),
    minSamples:options.minSamples??20,
    minConfidence:options.minConfidence??.62
  });
  if(!candidate)return {created:false,reason:"insufficient-evidence",observations:observations.length};
  const existing=await findCandidateByKey(candidate.id);
  if(existing)return {created:false,reason:"already-exists",candidate:existing,observations:observations.length};
  const candidateArchive=await archiveLearningJson({
    kind:"candidate",folder:"candidates",prefix:"candidate",
    payload:candidate,metadata:{skill:candidate.skill}
  });
  const row=await insertCandidate({
    candidate_key:candidate.id,
    skill:candidate.skill,
    current_version:candidate.currentVersion||null,
    candidate_version:candidate.candidateVersion||null,
    status:"candidate",
    sample_count:candidate.samples,
    confidence:candidate.confidence,
    proposal:candidate,
    regression:{},
    drive_file_id:candidateArchive.fileId
  });
  const regression=await runCandidateRegression(row);
  return {created:true,candidate:regression.candidate,report:regression.report,observations:observations.length};
}

export async function scanAllCandidates(){
  const runs=await listRuns(1000);
  const skills=[...new Set(runs.map((row:any)=>String(row.skill||"")).filter(Boolean))];
  const results=[];
  for(const skill of skills){
    try{results.push({skill,...await scanSkillCandidate(skill)});}
    catch(error){results.push({skill,created:false,reason:String(error)});}
  }
  return results;
}
