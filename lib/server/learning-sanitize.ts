import {createHash} from "node:crypto";
import {summarizeNodeForLearning,summarizeSceneForLearning,type VisualNode,type VisualScene} from "@innova-space/visual-engine";

export type CloudLearningEvent={
  id:string;timestamp:string;type:string;source?:string;runId?:string|null;sceneId?:string|null;skill?:string|null;engineVersion?:string|null;payload?:Record<string,unknown>;
};

function hash(value:string){return createHash("sha256").update(value).digest("hex");}
function textRef(value:string){return {kind:"text-ref",sha256:hash(value),characters:value.length};}
function isScene(value:any):value is VisualScene{return !!value&&value.version==="1.0"&&typeof value.id==="string"&&Array.isArray(value.nodes);}
function isNode(value:any):value is VisualNode{return !!value&&typeof value.id==="string"&&typeof value.type==="string";}

const safeStringKeys=new Set([
  "mode","format","mimeType","rating","status","engine","renderer","source","skill","visualType",
  "documentId","sceneId","lastEventType","kind","action","operation","eventType"
]);

function sanitizeValue(key:string,value:any,depth=0):any{
  if(depth>6)return {kind:"truncated"};
  if(value==null||typeof value==="number"||typeof value==="boolean")return value;
  if(typeof value==="string"){
    if(safeStringKeys.has(key))return value.slice(0,160);
    if(/^#[0-9a-f]{3,8}$/i.test(value))return value;
    return textRef(value);
  }
  if(Array.isArray(value))return value.slice(0,500).map(item=>sanitizeValue(key,item,depth+1));
  if(isScene(value))return {kind:"scene-summary",...summarizeSceneForLearning(value)};
  if(isNode(value))return {kind:"node-summary",...summarizeNodeForLearning(value)};
  if(typeof value==="object"){
    if(key==="document"&&Array.isArray(value.pages)){
      return {kind:"document-summary",id:String(value.id||""),pageCount:value.pages.length,pages:value.pages.filter(isScene).map(summarizeSceneForLearning)};
    }
    const out:Record<string,unknown>={};
    for(const [childKey,child] of Object.entries(value).slice(0,300))out[childKey]=sanitizeValue(childKey,child,depth+1);
    return out;
  }
  return String(value);
}

export function sanitizeLearningEvent(event:CloudLearningEvent):CloudLearningEvent{
  return {
    id:String(event.id),timestamp:String(event.timestamp),type:String(event.type),
    source:event.source?String(event.source):undefined,
    runId:event.runId?String(event.runId):null,
    sceneId:event.sceneId?String(event.sceneId):null,
    skill:event.skill?String(event.skill):null,
    engineVersion:event.engineVersion?String(event.engineVersion):null,
    payload:event.payload?sanitizeValue("payload",event.payload):undefined
  };
}

function numericLeaves(value:any,prefix="",out:Array<{path:string;value:number}>=[]){
  if(typeof value==="number"&&Number.isFinite(value)){out.push({path:prefix,value});return out;}
  if(!value||typeof value!=="object")return out;
  for(const [key,child] of Object.entries(value)){
    if(["zIndex","timestamp"].includes(key))continue;
    numericLeaves(child,prefix?prefix+"."+key:key,out);
  }
  return out;
}

export function extractLearningObservations(events:CloudLearningEvent[]){
  const outcomes=new Map<string,{accepted:boolean|null;exported:boolean;quality:number|null}>();
  for(const event of events){
    if(!event.runId)continue;
    const prev=outcomes.get(event.runId)||{accepted:null,exported:false,quality:null};
    if(event.type==="feedback.recorded"){
      prev.accepted=event.payload?.rating==="good";
      const q=Number(event.payload?.quality);if(Number.isFinite(q))prev.quality=q;
    }
    if(event.type.startsWith("export."))prev.exported=true;
    if(event.type==="generation.completed"&&prev.quality==null){
      const q=Number(event.payload?.quality);if(Number.isFinite(q))prev.quality=q;
    }
    outcomes.set(event.runId,prev);
  }

  const rows:Record<string,unknown>[]=[];
  for(const event of events){
    if(!["editor.commit","editor.undo","editor.redo"].includes(event.type))continue;
    const patches=Array.isArray(event.payload?.patches)?event.payload!.patches as any[]:[];
    const outcome=event.runId?outcomes.get(event.runId):undefined;
    for(const patch of patches){
      const before=patch?.before,after=patch?.after;
      const node=after||before;
      if(!node?.id||!node?.type)continue;
      if(patch.op!=="update"||!before||!after){
        rows.push({
          run_id:event.runId||null,skill:event.skill||null,event_type:event.type,node_type:String(node.type)+"#"+String(node.id),
          feature:"__"+String(patch.op||"change")+"__",accepted:outcome?.accepted??null,exported:outcome?.exported??false,
          quality_after:outcome?.quality??null,metadata:{operation:String(patch.op||"change")},occurred_at:event.timestamp
        });
        continue;
      }
      const beforeMap=new Map(numericLeaves(before).map(x=>[x.path,x.value]));
      const afterMap=new Map(numericLeaves(after).map(x=>[x.path,x.value]));
      for(const [path,afterValue] of afterMap){
        const beforeValue=beforeMap.get(path);
        if(beforeValue===undefined||beforeValue===afterValue)continue;
        rows.push({
          run_id:event.runId||null,skill:event.skill||null,event_type:event.type,node_type:String(after.type)+"#"+String(after.id),
          feature:path,before_value:beforeValue,after_value:afterValue,delta:afterValue-beforeValue,
          accepted:outcome?.accepted??null,exported:outcome?.exported??false,quality_after:outcome?.quality??null,
          metadata:{label:typeof event.payload?.label==="string"?textRef(String(event.payload.label)):null},occurred_at:event.timestamp
        });
      }
      for(const colorPath of ["paint.fill","paint.stroke"]){
        const get=(obj:any)=>colorPath.split(".").reduce((acc,key)=>acc?.[key],obj);
        const a=get(after),b=get(before);
        if(typeof a==="string"&&typeof b==="string"&&a!==b&&/^#[0-9a-f]{3,8}$/i.test(a)&&/^#[0-9a-f]{3,8}$/i.test(b)){
          rows.push({
            run_id:event.runId||null,skill:event.skill||null,event_type:event.type,node_type:String(after.type)+"#"+String(after.id),
            feature:colorPath,accepted:outcome?.accepted??null,exported:outcome?.exported??false,quality_after:outcome?.quality??null,
            metadata:{categorical:true,before:b,after:a},occurred_at:event.timestamp
          });
        }
      }
    }
  }
  return rows.slice(0,10000);
}
