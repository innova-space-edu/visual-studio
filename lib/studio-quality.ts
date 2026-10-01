import {
  analyzeAdvancedQuality,
  analyzeQuality,
  flattenNodes,
  type Diagnostic,
  type VisualScene
} from "@innova-space/visual-engine";

export interface StudioQualityReport {
  score:number;
  visualScore:number;
  semanticScore:number;
  diagnostics:Diagnostic[];
  metrics:{
    nodeCount:number;
    outOfBounds:number;
    duplicateIds:number;
    semanticRequired:number;
    semanticFulfilled:number;
    semanticMissing:number;
  };
}

type Requirement={id:string;nodeIds:string[]};

function promptRequirements(prompt:string):Requirement[]{
  const p=String(prompt||"");
  const req:Requirement[]=[];
  if(/homotecia/i.test(p)){
    req.push(
      {id:"plano cartesiano",nodeIds:["axis-x","axis-y"]},
      {id:"figura original",nodeIds:["triangle-original"]},
      {id:"figura transformada",nodeIds:["triangle-image"]},
      {id:"líneas de proyección",nodeIds:["projection-0","projection-1","projection-2"]},
      {id:"fórmula de homotecia",nodeIds:["homothety-formula"]}
    );
  }
  if(/(?:mol[eé]cula\s+de\s+agua|\bH2O\b|\bH₂O\b)/i.test(p)){
    req.push(
      {id:"átomos de H2O",nodeIds:["atom-o","atom-h-0","atom-h-1"]},
      {id:"enlaces de H2O",nodeIds:["bond-0","bond-1"]}
    );
    if(/ecuaci[oó]n/i.test(p))req.push({id:"ecuación química",nodeIds:["reaction-equation"]});
  }
  if(/infograf[ií]a/i.test(p)&&/(tres|3)\s+secciones/i.test(p)){
    req.push({id:"tres secciones",nodeIds:["section-0","section-1","section-2"]});
  }
  return req;
}

function metadataRequirements(scene:VisualScene):Requirement[]{
  const raw=scene.metadata?.semanticRequirements;
  if(!Array.isArray(raw))return [];
  return raw.flatMap((item:any)=>{
    if(!item||typeof item.id!=="string"||!Array.isArray(item.nodeIds))return [];
    return [{id:item.id,nodeIds:item.nodeIds.map(String)}];
  });
}

export function analyzeStudioQuality(scene:VisualScene,prompt=""):StudioQualityReport{
  const basic=analyzeQuality(scene);
  const advanced=analyzeAdvancedQuality(scene);
  const ids=new Set(flattenNodes(scene.nodes).map(node=>node.id));
  const combined=[...metadataRequirements(scene),...promptRequirements(prompt)];
  const unique=new Map<string,Requirement>();
  combined.forEach(req=>unique.set(req.id+"|"+req.nodeIds.join(","),req));
  const requirements=[...unique.values()];
  const missing=requirements.filter(req=>req.nodeIds.some(id=>!ids.has(id)));
  const fulfilled=requirements.length-missing.length;
  const semanticScore=requirements.length?100*fulfilled/requirements.length:100;

  const diagnostics:Diagnostic[]=[...basic.diagnostics,...advanced.diagnostics];
  missing.forEach(req=>diagnostics.push({
    level:"error",code:"semantic.missing",message:"Falta contenido solicitado: "+req.id
  }));

  const visualPenalty=
    basic.metrics.outOfBounds*8+
    basic.metrics.duplicateIds*25+
    advanced.metrics.tinyText*2+
    advanced.metrics.lowContrast*2+
    Math.max(0,advanced.metrics.edgeRisk-1)*.5;
  const visualScore=Math.max(0,Math.min(100,100-visualPenalty));
  const score=Math.max(0,Math.min(100,visualScore*.45+semanticScore*.55));

  return {
    score:Math.round(score),
    visualScore:Math.round(visualScore),
    semanticScore:Math.round(semanticScore),
    diagnostics,
    metrics:{
      nodeCount:basic.metrics.nodeCount,
      outOfBounds:basic.metrics.outOfBounds,
      duplicateIds:basic.metrics.duplicateIds,
      semanticRequired:requirements.length,
      semanticFulfilled:fulfilled,
      semanticMissing:missing.length
    }
  };
}
