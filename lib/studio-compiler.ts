import { compilePlanToScene } from "@innova-space/visual-design/engine";\nimport { parseVisualRequest, resolveKnowledgeContent, type MoleculeKnowledge } from "@/lib/knowledge-base";
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
  const value=raw.trim().replace(/\.$/,"").replace(/→/g,"->");
  return "\\ce{"+value+"}";
}

function extractEquation(prompt:string){
  const m=prompt.match(/ecuaci[oó]n\s+(.+?)(?:\.|$)/i);
  return m?.[1]?.trim()||"2H2 + O2 -> 2H2O";
}

function moleculePositions(molecule:MoleculeKnowledge,cx:number,cy:number){
  const n=molecule.atoms.length;
  if(n===2)return [[cx-90,cy],[cx+90,cy]] as Array<[number,number]>;
  if(n===3&&molecule.geometry==="lineal")return [[cx-145,cy],[cx,cy],[cx+145,cy]] as Array<[number,number]>;
  if(n===3)return [[cx,cy+35],[cx-110,cy-95],[cx+110,cy-95]] as Array<[number,number]>;
  if(n===4)return [[cx,cy],[cx-120,cy+90],[cx+120,cy+90],[cx,cy-135]] as Array<[number,number]>;
  if(n===5)return [[cx,cy],[cx-125,cy],[cx+125,cy],[cx,cy-130],[cx,cy+130]] as Array<[number,number]>;
  return molecule.atoms.map((_,i)=>{
    const angle=(Math.PI*2*i)/Math.max(1,n);
    return [cx+Math.cos(angle)*145,cy+Math.sin(angle)*145] as [number,number];
  });
}

function compileMolecule(prompt:string):VisualScene{
  const request=parseVisualRequest(prompt);
  const content=resolveKnowledgeContent(request,prompt);
  const molecule=content.molecule;
  if(!molecule)return compileInfographic(prompt);
  const width=1200,height=800;
  const nodes:VisualNode[]=[
    titleNode(content.title,width),
    text("molecule-kicker","MODELO MOLECULAR EDUCATIVO",64,118,360,28,13,800,C.violet)
  ];
  const cx=350,cy=405;
  const positions=moleculePositions(molecule,cx,cy);
  const centerIndex=molecule.atoms.length>2&&["angular","tetraédrica","piramidal trigonal"].includes(molecule.geometry)?0:
    molecule.atoms.length===3&&molecule.geometry==="lineal"?1:-1;

  if(centerIndex>=0){
    positions.forEach((pos,i)=>{
      if(i===centerIndex)return;
      nodes.push(line("bond-"+i,positions[centerIndex]![0],positions[centerIndex]![1],pos[0],pos[1],{stroke:"#64748b",strokeWidth:10}));
    });
  }else{
    for(let i=0;i<positions.length-1;i++){
      nodes.push(line("bond-"+i,positions[i]![0],positions[i]![1],positions[i+1]![0],positions[i+1]![1],{stroke:"#64748b",strokeWidth:10}));
    }
  }

  positions.forEach((pos,i)=>{
    const atom=molecule.atoms[i]!;
    const radius=atom.symbol.length>2?45:40;
    nodes.push(circle("atom-"+i,pos[0],pos[1],radius,atom.color,C.ink));
    nodes.push(text("atom-label-"+i,atom.symbol,pos[0]-28,pos[1]-18,56,40,22,850,C.ink,"middle"));
    nodes.push(text("atom-name-"+i,atom.label,pos[0]-70,pos[1]+52,140,30,13,650,C.muted,"middle"));
  });

  if(molecule.angle){
    nodes.push(text("molecule-angle",molecule.angle,cx-60,cy+165,120,32,15,750,C.muted,"middle"));
  }

  const x=650,y=160,w=470,h=500;
  nodes.push(rect("molecule-info",x,y,w,h,"#ffffff","#cbd5e1",24));
  nodes.push(text("molecule-info-title","Propiedades principales",x+28,y+24,w-56,38,20,800,C.green));
  const facts=[
    ["Fórmula",molecule.formula],
    ["Geometría",molecule.geometry],
    ["Enlace",molecule.bondType],
    ["Polaridad",molecule.polarity]
  ];
  facts.forEach((fact,i)=>{
    const fy=y+88+i*65;
    nodes.push(text("fact-label-"+i,fact[0],x+28,fy,w-56,24,14,800,C.muted));
    nodes.push(text("fact-value-"+i,fact[1],x+28,fy+24,w-56,34,19,700,C.ink));
  });
  nodes.push(text("molecule-description",molecule.description,x+28,y+365,w-56,108,16,520,C.ink));

  return createScene({
    id:"studio-molecule-"+molecule.formula.toLowerCase(),width,height,background:"#f8fafc",
    title:content.title,
    description:molecule.description,
    metadata:{
      source:"visual-studio/dynamic-compiler",
      visual_type:"chemistry-diagram",
      selected_skills:["chemistry-diagram","educational-image"],
      topic:request.topic,
      formula:molecule.formula,
      semanticRequirements:[
        {id:"molecule-atoms",nodeIds:positions.map((_,i)=>"atom-"+i)},
        {id:"molecule-properties",nodeIds:["molecule-info","molecule-description"]}
      ]
    },
    nodes
  });
}

function compileInfographic(prompt:string):VisualScene{
  const request=parseVisualRequest(prompt);
  const content=resolveKnowledgeContent(request,prompt);
  const width=1200,height=800;
  const sections=content.sections.slice(0,6);
  const cols=sections.length<=3?sections.length:3;
  const rows=Math.ceil(sections.length/cols);
  const gap=22;
  const areaX=64,areaY=190,areaW=1072,areaH=510;
  const cardW=(areaW-gap*(cols-1))/cols;
  const cardH=(areaH-gap*(rows-1))/rows;
  const palette=[
    [C.blueSoft,C.blue],[C.greenSoft,C.green],[C.violetSoft,C.violet],
    [C.amberSoft,C.amber],[C.redSoft,C.red],["#e0f2fe","#0284c7"]
  ] as const;
  const nodes:VisualNode[]=[
    titleNode(content.title,width),
    text("topic-kicker",(content.subtitle||"INFOGRAFÍA EDUCATIVA").toUpperCase(),64,118,820,34,13,800,C.blue)
  ];

  sections.forEach((section,i)=>{
    const row=Math.floor(i/cols),col=i%cols;
    const x=areaX+col*(cardW+gap),y=areaY+row*(cardH+gap);
    const colors=palette[i%palette.length]!;
    nodes.push(rect("section-"+i,x,y,cardW,cardH,colors[0],colors[1],24));
    nodes.push(circle("section-icon-"+i,x+42,y+42,20,"#ffffff",colors[1]));
    nodes.push(text("section-number-"+i,String(i+1),x+31,y+27,22,24,14,850,colors[1],"middle"));
    nodes.push(text("section-title-"+i,section.heading,x+24,y+74,cardW-48,Math.min(52,cardH*.24),20,800,C.ink));
    const body=section.body||(section.bullets||[]).map(item=>"• "+item).join("\n");
    nodes.push(text("section-body-"+i,body,x+24,y+132,cardW-48,Math.max(80,cardH-156),16,520,C.ink));
  });

  if(content.formula){
    nodes.push({id:"infographic-equation",type:"math",x:390,y:725,latex:chemicalLatex(content.formula),scale:.68,paint:{fill:C.ink}});
  }

  return createScene({
    id:"studio-infographic-"+request.normalizedTopic.replace(/[^a-z0-9]+/g,"-").slice(0,40),
    width,height,background:"#f8fafc",
    title:content.title,
    description:content.subtitle||("Infografía educativa sobre "+request.topic),
    metadata:{
      source:"visual-studio/dynamic-compiler",
      visual_type:"infographic",
      selected_skills:["infographic","educational-image"],
      topic:request.topic,
      subject:request.subject||"general",
      knowledgeMode:content.molecule?"molecule":"local-catalog",
      semanticRequirements:sections.map((_,i)=>({id:"section-"+i,nodeIds:["section-"+i,"section-title-"+i,"section-body-"+i]}))
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
  const p=String(prompt||"").trim();
  const request=parseVisualRequest(p);
  if(/homotecia/i.test(p))return compileHomothety(p);
  if(request.kind==="molecule")return compileMolecule(p);
  if(request.kind==="flowchart")return compileFlow(p);
  if(request.kind==="infographic")return compileInfographic(p);
  return repairScene(compilePlanToScene(plan) as VisualScene);
}
