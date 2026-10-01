import { compilePlanToScene } from "@innova-space/visual-design/engine";
import {
  createScene,
  fitText,
  homothety,
  type Paint,
  type Point,
  type TextNode,
  type VisualNode,
  type VisualScene
} from "@innova-space/visual-engine";

const C={
  ink:"#0f172a",muted:"#64748b",grid:"#e2e8f0",blue:"#2563eb",blueSoft:"#dbeafe",
  violet:"#7c3aed",violetSoft:"#ede9fe",green:"#059669",greenSoft:"#d1fae5",
  red:"#dc2626",redSoft:"#fee2e2",amber:"#d97706",amberSoft:"#fef3c7"
};

function text(
  id:string,value:string,x:number,y:number,width:number,height:number,
  size=24,weight:number|string=500,fill=C.ink,align:"start"|"middle"|"end"="start"
):TextNode{
  const fitted=fitText(String(value),width,height,{
    family:"Inter,Arial,sans-serif",size,weight,lineHeight:1.16,align
  },{minSize:12,maxSize:size});
  return {
    id,type:"text",x,y:y+(fitted.style.size??size),
    text:fitted.lines.join("\n"),maxWidth:width,
    style:{...fitted.style,align},
    paint:{fill}
  };
}

function rect(id:string,x:number,y:number,width:number,height:number,fill="#ffffff",stroke=C.grid,rx=18):VisualNode{
  return {id,type:"rect",x,y,width,height,rx,paint:{fill,stroke,strokeWidth:1.5}};
}
function line(id:string,x1:number,y1:number,x2:number,y2:number,paint:Paint={},arrow=false):VisualNode{
  return {id,type:"line",x1,y1,x2,y2,markerEnd:arrow,paint:{stroke:C.ink,strokeWidth:2,lineCap:"round",...paint}};
}
function polygon(id:string,points:Array<[number,number]>,fill:string,stroke:string):VisualNode{
  return {id,type:"polygon",points,paint:{fill,stroke,strokeWidth:3,lineJoin:"round"}};
}
function circle(id:string,cx:number,cy:number,r:number,fill:string,stroke=C.ink):VisualNode{
  return {id,type:"circle",cx,cy,r,paint:{fill,stroke,strokeWidth:2}};
}

function conciseTitle(prompt:string,fallback:string){
  const clean=prompt.replace(/^\s*(crea|crear|haz|hace|genera|generar)\s+(un|una)?\s*/i,"").trim();
  return clean.length<=64?clean:fallback;
}

function titleNode(title:string,width=1200){
  return text("title",title,64,38,width-128,86,40,800,C.ink);
}

function cartesianGrid(frame:{x:number;y:number;width:number;height:number},step=48){
  const nodes:VisualNode[]=[];
  for(let x=frame.x;x<=frame.x+frame.width+.1;x+=step){
    nodes.push(line("grid-v-"+nodes.length,x,frame.y,x,frame.y+frame.height,{stroke:C.grid,strokeWidth:1}));
  }
  for(let y=frame.y;y<=frame.y+frame.height+.1;y+=step){
    nodes.push(line("grid-h-"+nodes.length,frame.x,y,frame.x+frame.width,y,{stroke:C.grid,strokeWidth:1}));
  }
  const ox=frame.x+frame.width/2,oy=frame.y+frame.height/2;
  nodes.push(line("axis-x",frame.x,oy,frame.x+frame.width,oy,{stroke:C.ink,strokeWidth:2},true));
  nodes.push(line("axis-y",ox,frame.y+frame.height,ox,frame.y,{stroke:C.ink,strokeWidth:2},true));
  return nodes;
}

function parseScale(prompt:string){
  const m=prompt.match(/\bk\s*=\s*(-?\d+(?:[.,]\d+)?)/i);
  return m?Number(m[1]!.replace(",",".")):-2;
}

function compileHomothety(prompt:string):VisualScene{
  const width=1200,height=800,k=parseScale(prompt);
  const frame={x:70,y:150,width:650,height:540};
  const ox=frame.x+frame.width/2,oy=frame.y+frame.height/2,unit=45;
  const toScreen=(p:Point):[number,number]=>[ox+p.x*unit,oy-p.y*unit];

  const original=[{x:1,y:1},{x:3,y:1},{x:2,y:3}];
  const image=original.map(p=>homothety(p,{x:0,y:0},k));
  const originalScreen=original.map(toScreen);
  const imageScreen=image.map(toScreen);
  const nodes:VisualNode[]=[
    titleNode("Homotecia en el plano cartesiano · k = "+String(k),width),
    ...cartesianGrid(frame,45)
  ];

  originalScreen.forEach((p,i)=>{
    const q=imageScreen[i]!;
    nodes.push(line("projection-"+i,q[0],q[1],p[0],p[1],{stroke:"#94a3b8",strokeWidth:1.5,dash:[7,6]}));
  });
  nodes.push(polygon("triangle-original",originalScreen,C.blueSoft,C.blue));
  nodes.push(polygon("triangle-image",imageScreen,C.violetSoft,C.violet));

  const labels=["A","B","C"];
  originalScreen.forEach((p,i)=>{
    nodes.push(circle("point-original-"+i,p[0],p[1],5,"#ffffff",C.blue));
    nodes.push(text("label-original-"+i,labels[i]!,p[0]+9,p[1]-22,42,28,16,800,C.blue));
  });
  imageScreen.forEach((p,i)=>{
    nodes.push(circle("point-image-"+i,p[0],p[1],5,"#ffffff",C.violet));
    nodes.push(text("label-image-"+i,labels[i]+"′",p[0]+9,p[1]-22,48,28,16,800,C.violet));
  });
  nodes.push(circle("homothety-center",ox,oy,6,C.ink,C.ink));
  nodes.push(text("center-label","O",ox+10,oy+7,30,24,15,800,C.ink));

  const cx=765,cy=150,cw=370,ch=540;
  nodes.push(rect("formula-card",cx,cy,cw,ch,"#ffffff","#cbd5e1",24));
  nodes.push(text("formula-title","Regla de transformación",cx+28,cy+25,cw-56,44,20,800,C.blue));
  nodes.push({id:"homothety-formula",type:"math",x:cx+28,y:cy+105,latex:"P' = O + k(P-O)",scale:.9,paint:{fill:C.ink}});
  nodes.push(text("factor-label","Factor de homotecia",cx+28,cy+150,cw-56,30,15,700,C.muted));
  nodes.push(text("factor-value","k = "+String(k),cx+28,cy+182,cw-56,50,30,850,k<0?C.red:C.green));
  nodes.push(text("factor-meaning",k<0
    ?"k < 0: la imagen queda al lado opuesto del centro O."
    :"k > 0: la imagen conserva el lado respecto del centro O.",
    cx+28,cy+242,cw-56,75,17,550,C.ink));
  nodes.push(text("coordinate-title","Coordenadas",cx+28,cy+330,cw-56,30,17,800,C.violet));
  original.forEach((p,i)=>{
    const q=image[i]!;
    nodes.push(text("coordinate-"+i,
      labels[i]+"("+p.x+", "+p.y+")  →  "+labels[i]+"′("+q.x+", "+q.y+")",
      cx+28,cy+370+i*42,cw-56,34,16,650,C.ink));
  });

  return createScene({
    id:"studio-homothety",width,height,background:"#f8fafc",
    title:"Homotecia k="+String(k),
    description:"Construcción determinista de homotecia con triángulo original, imagen y líneas de proyección.",
    variables:{k},
    metadata:{
      source:"visual-studio/enhanced-compiler",
      visual_type:"math-diagram",
      selected_skills:["math-diagram"],
      semanticRequirements:[
        {id:"cartesian-plane",nodeIds:["axis-x","axis-y"]},
        {id:"original-figure",nodeIds:["triangle-original"]},
        {id:"transformed-figure",nodeIds:["triangle-image"]},
        {id:"projection-lines",nodeIds:["projection-0","projection-1","projection-2"]},
        {id:"homothety-formula",nodeIds:["homothety-formula"]}
      ]
    },
    nodes
  });
}

function chemicalLatex(raw:string){
  let value=raw.trim().replace(/\.$/,"").replace(/->|→/g,"\\rightarrow");
  value=value.replace(/([A-Z][a-z]?)(\d+)/g,"$1_{$2}");
  return "\\mathrm{"+value.replace(/\s+/g,"\\; ")+"}";
}

function extractEquation(prompt:string){
  const m=prompt.match(/ecuaci[oó]n\s+(.+?)(?:\.|$)/i);
  return m?.[1]?.trim()||"2H2 + O2 -> 2H2O";
}

function compileWaterChemistry(prompt:string):VisualScene{
  const width=1200,height=800;
  const nodes:VisualNode[]=[titleNode("Molécula de agua (H₂O) y ecuación química",width)];
  const ox=360,oy=380,bond=135;
  const half=104.5/2;
  const leftAngle=(90+half)*Math.PI/180;
  const rightAngle=(90-half)*Math.PI/180;
  const h1={x:ox+Math.cos(leftAngle)*bond,y:oy-Math.sin(leftAngle)*bond};
  const h2={x:ox+Math.cos(rightAngle)*bond,y:oy-Math.sin(rightAngle)*bond};

  nodes.push(line("bond-0",ox,oy,h1.x,h1.y,{stroke:"#64748b",strokeWidth:12}));
  nodes.push(line("bond-1",ox,oy,h2.x,h2.y,{stroke:"#64748b",strokeWidth:12}));
  nodes.push(circle("atom-o",ox,oy,52,C.redSoft,"#991b1b"));
  nodes.push(circle("atom-h-0",h1.x,h1.y,38,C.blueSoft,"#1d4ed8"));
  nodes.push(circle("atom-h-1",h2.x,h2.y,38,C.blueSoft,"#1d4ed8"));
  nodes.push(text("atom-o-label","O",ox-13,oy-17,30,36,24,850,"#7f1d1d"));
  nodes.push(text("atom-h0-label","H",h1.x-12,h1.y-16,30,34,21,850,"#1e3a8a"));
  nodes.push(text("atom-h1-label","H",h2.x-12,h2.y-16,30,34,21,850,"#1e3a8a"));
  nodes.push(text("bond-angle","≈ 104,5°",ox-42,oy+68,110,32,15,700,C.muted));

  nodes.push(rect("chem-info-card",610,160,500,430,"#ffffff","#cbd5e1",24));
  nodes.push(text("chem-card-title","Representación estructurada",638,188,444,40,20,800,C.green));
  nodes.push(text("chem-copy",
    "La molécula conserva cada átomo como un elemento editable. La geometría muestra la forma angular característica del agua.",
    638,238,444,92,17,520,C.ink));
  nodes.push(text("equation-label","Ecuación solicitada",638,355,444,30,16,800,C.muted));
  nodes.push({id:"reaction-equation",type:"math",x:638,y:430,latex:chemicalLatex(extractEquation(prompt)),scale:.78,paint:{fill:C.ink}});
  nodes.push(text("chem-note",
    "La ecuación se renderiza como matemática, no como píxeles generados.",
    638,500,444,60,15,550,C.muted));

  return createScene({
    id:"studio-water-chemistry",width,height,background:"#f8fafc",
    title:"Molécula de agua H2O",
    description:"Modelo 2D determinista de H2O con geometría angular y ecuación química.",
    metadata:{
      source:"visual-studio/enhanced-compiler",
      visual_type:"chemistry-diagram",
      selected_skills:["chemistry-diagram"],
      semanticRequirements:[
        {id:"water-atoms",nodeIds:["atom-o","atom-h-0","atom-h-1"]},
        {id:"water-bonds",nodeIds:["bond-0","bond-1"]},
        {id:"reaction-equation",nodeIds:["reaction-equation"]}
      ]
    },
    nodes
  });
}

function topicFromPrompt(prompt:string){
  const m=prompt.match(/\bsobre\s+(.+?)(?:\s+con\s+\d+|\s+con\s+(?:tres|cuatro|cinco)|\.|$)/i);
  return (m?.[1]||prompt).trim();
}

function compileInfographic(prompt:string):VisualScene{
  const width=1200,height=800,topic=topicFromPrompt(prompt);
  const normalized=topic.toLowerCase();
  const conservation=/conservaci[oó]n.*materia/.test(normalized);
  const sections=conservation?[
    ["Principio","La materia no se crea ni se destruye: los átomos se reorganizan."],
    ["En una reacción","Los reactivos y productos contienen la misma cantidad de cada elemento."],
    ["Cómo comprobarlo","Cuenta los átomos a ambos lados y balancea los coeficientes cuando sea necesario."]
  ]:[
    ["Idea clave","Define el concepto central con una frase breve y verificable."],
    ["Representación","Organiza relaciones, datos o pasos mediante elementos editables."],
    ["Verificación","Comprueba que texto, cifras y estructura coincidan con la solicitud."]
  ];
  const nodes:VisualNode[]=[
    titleNode(conservation?"Conservación de la materia":conciseTitle(prompt,topic),width),
    text("topic-kicker","INFOGRAFÍA EDUCATIVA",64,118,300,28,13,800,C.blue)
  ];
  const colors=[[C.blueSoft,C.blue],[C.greenSoft,C.green],[C.violetSoft,C.violet]] as const;
  sections.forEach((section,i)=>{
    const x=64+i*365,y=190;
    nodes.push(rect("section-"+i,x,y,330,430,colors[i]![0],colors[i]![1],26));
    nodes.push(circle("section-icon-"+i,x+54,y+60,24,"#ffffff",colors[i]![1]));
    nodes.push(text("section-number-"+i,String(i+1),x+45,y+43,24,26,16,850,colors[i]![1]));
    nodes.push(text("section-title-"+i,section[0],x+28,y+105,274,56,23,800,C.ink));
    nodes.push(text("section-body-"+i,section[1],x+28,y+180,274,190,18,520,C.ink));
  });
  if(conservation){
    nodes.push({id:"infographic-equation",type:"math",x:376,y:685,latex:"2H_2 + O_2 \\rightarrow 2H_2O",scale:.72,paint:{fill:C.ink}});
  }

  return createScene({
    id:"studio-infographic",width,height,background:"#f8fafc",
    title:conservation?"Conservación de la materia":topic,
    metadata:{
      source:"visual-studio/enhanced-compiler",
      visual_type:"infographic",
      selected_skills:["infographic","educational-image"],
      semanticRequirements:[
        {id:"three-sections",nodeIds:["section-0","section-1","section-2"]}
      ]
    },
    nodes
  });
}

function compileFlow(prompt:string):VisualScene{
  const width=1200,height=800;
  const after=prompt.split(":").slice(1).join(":");
  const labels=(after?after.split(/[,;]+/):[]).map(x=>x.trim()).filter(Boolean).slice(0,6);
  const steps=labels.length>=2?labels:["Solicitud","Validación","Render","Control de calidad","Exportación"];
  const nodes:VisualNode[]=[titleNode("Flujo del proceso",width)];
  const left=70,right=1130,y=350;
  const spacing=(right-left)/Math.max(1,steps.length-1);
  steps.forEach((labelValue,i)=>{
    const cx=left+i*spacing,cardW=Math.min(180,spacing-28),x=cx-cardW/2;
    nodes.push(rect("flow-node-"+i,x,y,cardW,110,i===0?C.greenSoft:i===steps.length-1?C.violetSoft:"#ffffff",i===0?C.green:i===steps.length-1?C.violet:"#94a3b8",20));
    nodes.push(text("flow-label-"+i,labelValue,x+cardW/2,y+25,cardW-32,65,17,700,C.ink,"middle"));
    if(i<steps.length-1)nodes.push(line("flow-edge-"+i,x+cardW,y+55,left+(i+1)*spacing-cardW/2-12,y+55,{stroke:C.ink,strokeWidth:2.5},true));
  });
  return createScene({
    id:"studio-flow",width,height,background:"#f8fafc",title:"Flujo del proceso",
    metadata:{
      source:"visual-studio/enhanced-compiler",visual_type:"flowchart-diagram",
      selected_skills:["flowchart-diagram"],
      semanticRequirements:steps.map((_,i)=>({id:"step-"+i,nodeIds:["flow-node-"+i,"flow-label-"+i]}))
    },nodes
  });
}

function repairScene(scene:VisualScene):VisualScene{
  const next=structuredClone(scene);
  const title=next.nodes.find(node=>node.id==="title"&&node.type==="text");
  if(title&&title.type==="text"){
    const available=Math.max(160,next.width-title.x-64);
    const fitted=fitText(title.text,available,82,{
      ...(title.style||{}),size:title.style?.size??40,lineHeight:1.12
    },{minSize:18,maxSize:title.style?.size??40});
    title.text=fitted.lines.join("\n");
    title.maxWidth=available;
    title.style=fitted.style;
  }
  next.metadata={...(next.metadata||{}),source:(next.metadata?.source||"visual-design-skills")+"+studio-repair"};
  return next;
}

export function compileStudioPrompt(prompt:string,plan:any):VisualScene{
  const p=String(prompt||"");
  if(/homotecia/i.test(p))return compileHomothety(p);
  if(/(?:mol[eé]cula\s+de\s+agua|\bH2O\b|\bH₂O\b)/i.test(p))return compileWaterChemistry(p);
  if(/diagrama\s+de\s+flujo|flujo\s+del\s+proceso/i.test(p))return compileFlow(p);
  if(/infograf[ií]a/i.test(p))return compileInfographic(p);
  return repairScene(compilePlanToScene(plan) as VisualScene);
}
