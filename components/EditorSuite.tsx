"use client";

import dynamic from "next/dynamic";
import {useEffect,useMemo,useRef,useState} from "react";
import {
  SceneHistory,VisualLearningEngineV2,
  addNode,alignNodes,createDocument,createScene,diffScenes,distributeNodes,duplicateNodes,
  findNode,flattenNodes,groupNodes,removeNode,reorderNode,tableNodes,ungroupNode,updateNode,
  type AlignMode,type DistributeMode,type ImageNode,type LearningSnapshotV2,type VisualDocument,type VisualNode,type VisualScene
} from "@innova-space/visual-engine";
import * as VisualAssets from "@innova-space/visual-assets";

const AssetRuntime=VisualAssets as typeof VisualAssets & {
  recordAssetUsage:(input:any)=>any;
  exportAssetLearning:()=>any;
  importAssetLearning:(snapshot:any)=>void;
};
import RichTextEditor from "@/components/editor/RichTextEditor";
import ImageCropper from "@/components/editor/ImageCropper";
import {
  enqueueLearningEvent,installLearningAutoSync,
  listSceneVersions,loadLatestScene,loadLatestVisualDocument,loadLearningSnapshot,
  recordSceneVersion,saveLearningSnapshot,saveLocalScene,saveVisualDocument
} from "@/lib/persistence";
import type {EditorTool,PaintSettings} from "@/components/editor/KonvaSceneCanvas";

const KonvaSceneCanvas=dynamic(()=>import("@/components/editor/KonvaSceneCanvas"),{ssr:false});

type SidebarTab="layers"|"assets"|"pages"|"history";

const DEFAULT_SCENE=createScene({
  id:"editor-v4-page-1",width:1200,height:800,background:"#ffffff",title:"Visual Editor V4",
  nodes:[
    {id:"title",type:"text",x:72,y:92,text:"Visual Editor V4",maxWidth:650,style:{size:42,weight:800,lineHeight:1.15},paint:{fill:"#0f172a"}},
    {id:"subtitle",type:"text",x:72,y:145,text:"Selecciona, agrega, dibuja y edita cada elemento.",maxWidth:720,style:{size:20,weight:500,lineHeight:1.4},paint:{fill:"#475569"}}
  ]
});

function clone<T>(value:T):T{
  return typeof structuredClone==="function"?structuredClone(value):JSON.parse(JSON.stringify(value)) as T;
}
function uid(prefix:string){return prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6);}
function htmlFromText(value:string){
  return String(value||"").split("\n").map(line=>"<p>"+line.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]||c))+"</p>").join("");
}
function firstSkill(scene:VisualScene){
  const raw=scene.metadata?.selected_skills;
  return Array.isArray(raw)&&raw[0]?String(raw[0]):String(scene.metadata?.visual_type||"editor.generic");
}
function runIdFor(scene:VisualScene){
  return String(scene.metadata?.learningRunId||scene.id||"editor-session");
}
function nodeLabel(node:VisualNode){
  return String((node.metadata?.name as string)||node.id);
}
function zMax(scene:VisualScene){
  return Math.max(0,...flattenNodes(scene.nodes).map(n=>n.zIndex||0));
}
function makeTriangle():VisualNode{
  return {id:uid("triangle"),type:"polygon",points:[[120,230],[280,230],[200,90]],paint:{fill:"#dbeafe",stroke:"#2563eb",strokeWidth:3},zIndex:20};
}
function makeStar():VisualNode{
  const cx=220,cy=170,outer=90,inner=42,points:Array<[number,number]>=[];
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2===0?outer:inner;points.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}
  return {id:uid("star"),type:"polygon",points,paint:{fill:"#fef3c7",stroke:"#d97706",strokeWidth:3},zIndex:20};
}
function makeTable(scene:VisualScene):VisualNode{
  return {
    id:uid("table"),type:"group",zIndex:zMax(scene)+1,
    metadata:{kind:"table",rows:3,columns:3},
    children:tableNodes(uid("table-content"),[
      ["Encabezado 1","Encabezado 2","Encabezado 3"],
      ["Dato A","Dato B","Dato C"],
      ["Dato D","Dato E","Dato F"]
    ],120,160,720,{headerRows:1,rowHeight:54})
  };
}
function assetPreviewNode(asset:any,scene:VisualScene):VisualNode{
  const id=String(asset?.id||"asset");
  const base={zIndex:zMax(scene)+1,metadata:{assetId:id,assetName:asset?.name||id}};
  if(id.includes("triangle"))return {...makeTriangle(),...base,id:uid("asset-triangle")} as VisualNode;
  if(id.includes("atom"))return {id:uid("asset-atom"),type:"circle",cx:260,cy:220,r:46,paint:{fill:"#fee2e2",stroke:"#dc2626",strokeWidth:3},...base} as VisualNode;
  if(id.includes("pin"))return {id:uid("asset-pin"),type:"circle",cx:240,cy:220,r:18,paint:{fill:"#2563eb",stroke:"#ffffff",strokeWidth:3},...base} as VisualNode;
  if(id.includes("arrow")||id.includes("connector"))return {id:uid("asset-arrow"),type:"line",x1:120,y1:220,x2:380,y2:220,markerEnd:true,paint:{stroke:"#334155",strokeWidth:3},...base} as VisualNode;
  if(id.includes("table"))return {...makeTable(scene),...base,id:uid("asset-table")} as VisualNode;
  if(id.includes("card")||id.includes("poster")||id.includes("slide")||id.includes("page")){
    return {id:uid("asset-card"),type:"rect",x:120,y:140,width:360,height:220,rx:22,paint:{fill:"#f8fafc",stroke:"#94a3b8",strokeWidth:2},...base} as VisualNode;
  }
  if(id.startsWith("icon.")){
    return {id:uid("asset-icon"),type:"circle",cx:220,cy:200,r:36,paint:{fill:"#ede9fe",stroke:"#7c3aed",strokeWidth:3},...base} as VisualNode;
  }
  return {id:uid("asset"),type:"rect",x:130,y:150,width:280,height:160,rx:18,paint:{fill:"#eef2ff",stroke:"#6366f1",strokeWidth:2},...base} as VisualNode;
}

export default function EditorSuite(){
  const [document,setDocument]=useState<VisualDocument>(()=>createDocument("visual-document-v4",[DEFAULT_SCENE]));
  const [pageIndex,setPageIndex]=useState(0);
  const scene=document.pages[pageIndex]||DEFAULT_SCENE;
  const historyRef=useRef(new SceneHistory(scene,150));
  const learningRef=useRef(new VisualLearningEngineV2());
  const fileInputRef=useRef<HTMLInputElement|null>(null);
  const jsonInputRef=useRef<HTMLInputElement|null>(null);
  const clipboardRef=useRef<VisualNode[]>([]);
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [tool,setTool]=useState<EditorTool>("select");
  const [zoom,setZoom]=useState(.72);
  const [showGrid,setShowGrid]=useState(true);
  const [tab,setTab]=useState<SidebarTab>("layers");
  const [status,setStatus]=useState("Cargando documento…");
  const [assetQuery,setAssetQuery]=useState("");
  const [layerQuery,setLayerQuery]=useState("");
  const [versions,setVersions]=useState<any[]>([]);
  const [cropImage,setCropImage]=useState<ImageNode|null>(null);
  const [paint,setPaint]=useState<PaintSettings>({
    fill:"#dbeafe",stroke:"#2563eb",strokeWidth:2,opacity:1,brushSize:6
  });

  const selected=selectedIds.length===1?findNode(scene,selectedIds[0]!):null;
  const layers=useMemo(()=>{
    const q=layerQuery.toLowerCase().trim();
    return flattenNodes(scene.nodes).slice().sort((a,b)=>(b.zIndex||0)-(a.zIndex||0))
      .filter(node=>!q||node.id.toLowerCase().includes(q)||node.type.includes(q));
  },[scene,layerQuery]);
  const assets=useMemo(()=>VisualAssets.searchAssets(assetQuery).slice(0,60),[assetQuery]);

  useEffect(()=>{
    let active=true;
    Promise.all([
      loadLatestVisualDocument(),
      loadLatestScene(),
      loadLearningSnapshot<LearningSnapshotV2>("engine-v2"),
      loadLearningSnapshot<any>("assets-v1")
    ]).then(([savedDoc,savedScene,learning,assetLearning])=>{
      if(!active)return;
      const next=savedDoc||(savedScene?createDocument("visual-document-v4",[savedScene]):createDocument("visual-document-v4",[DEFAULT_SCENE]));
      setDocument(next);setPageIndex(0);
      historyRef.current.reset(next.pages[0]||DEFAULT_SCENE);
      if(learning?.version==="2.0")learningRef.current.restore(learning);
      if(assetLearning?.version==="1.0")try{AssetRuntime.importAssetLearning(assetLearning);}catch{}
      setStatus("Editor V4 listo · aprendizaje activo");
      const first=next.pages[0]||DEFAULT_SCENE;
      void enqueueLearningEvent({
        type:"editor.session.started",source:"visual-studio",runId:runIdFor(first),sceneId:first.id,
        skill:firstSkill(first),payload:{documentId:next.id,pageIndex:0,scene:first}
      });
      void refreshVersions(next.pages[0]?.id);
    }).catch(()=>setStatus("Editor V4 listo"));
    return ()=>{active=false;};
  },[]);

  useEffect(()=>installLearningAutoSync(),[]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      const typing=target&&(["INPUT","TEXTAREA"].includes(target.tagName)||target.isContentEditable);
      if(typing)return;
      const mod=event.ctrlKey||event.metaKey;
      if(mod&&event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redo():undo();return;}
      if(mod&&event.key.toLowerCase()==="y"){event.preventDefault();redo();return;}
      if(mod&&event.key.toLowerCase()==="a"){event.preventDefault();setSelectedIds(flattenNodes(scene.nodes).filter(n=>!n.locked).map(n=>n.id));return;}
      if(mod&&event.key.toLowerCase()==="c"){event.preventDefault();copySelection();return;}
      if(mod&&event.key.toLowerCase()==="x"){event.preventDefault();cutSelection();return;}
      if(mod&&event.key.toLowerCase()==="v"){event.preventDefault();pasteSelection();return;}
      if(mod&&event.key.toLowerCase()==="d"){event.preventDefault();duplicateSelection();return;}
      if(mod&&event.key.toLowerCase()==="g"){event.preventDefault();groupSelection();return;}
      if(event.key==="Delete"||event.key==="Backspace"){event.preventDefault();deleteSelection();return;}
      const step=event.shiftKey?10:1;
      if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)&&selectedIds.length){
        event.preventDefault();
        const dx=event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0;
        const dy=event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0;
        let next=scene;
        for(const id of selectedIds){
          const node=findNode(next,id);if(!node||node.locked)continue;
          const t=node.transform||{};
          next=updateNode(next,id,{transform:{...t,x:(t.x||0)+dx,y:(t.y||0)+dy}});
        }
        commit(next,"Mover con teclado");
      }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[scene,selectedIds]);

  async function refreshVersions(sceneId=scene.id){
    try{setVersions(await listSceneVersions(sceneId,40));}catch{}
  }

  function updatePage(nextScene:VisualScene){
    const nextDoc=clone(document);
    nextDoc.pages[pageIndex]=nextScene;
    setDocument(nextDoc);
    return nextDoc;
  }

  async function persist(nextDoc:VisualDocument,nextScene:VisualScene,label:string){
    await Promise.all([
      saveVisualDocument(nextDoc),saveLocalScene(nextScene),saveLearningSnapshot(learningRef.current.snapshot(),"engine-v2"),
      saveLearningSnapshot(AssetRuntime.exportAssetLearning(),"assets-v1"),recordSceneVersion(nextScene,label)
    ]);
  }

  function commit(nextScene:VisualScene,label:string){
    const before=scene;
    const patches=diffScenes(before,nextScene);
    historyRef.current.commit(nextScene,label);
    const skill=firstSkill(nextScene);
    learningRef.current.learnEdit(before,nextScene,{scope:"skill",key:skill,context:{editor:"v4",label}});
    const nextDoc=updatePage(nextScene);
    setStatus(label+" · aprendizaje registrado");
    void enqueueLearningEvent({
      type:"editor.commit",source:"visual-studio",runId:runIdFor(nextScene),sceneId:nextScene.id,skill,
      payload:{label,pageIndex,patches,documentId:nextDoc.id}
    });
    void persist(nextDoc,nextScene,label).then(()=>refreshVersions(nextScene.id)).catch(()=>{});
  }

  function undo(){
    const before=scene;const next=historyRef.current.undo();const nextDoc=updatePage(next);setStatus("Deshacer");
    void enqueueLearningEvent({type:"editor.undo",source:"visual-studio",runId:runIdFor(next),sceneId:next.id,skill:firstSkill(next),payload:{patches:diffScenes(before,next),documentId:nextDoc.id}});
    void saveVisualDocument(nextDoc);void saveLocalScene(next);
  }
  function redo(){
    const before=scene;const next=historyRef.current.redo();const nextDoc=updatePage(next);setStatus("Rehacer");
    void enqueueLearningEvent({type:"editor.redo",source:"visual-studio",runId:runIdFor(next),sceneId:next.id,skill:firstSkill(next),payload:{patches:diffScenes(before,next),documentId:nextDoc.id}});
    void saveVisualDocument(nextDoc);void saveLocalScene(next);
  }

  function copySelection(){
    clipboardRef.current=selectedIds.map(id=>findNode(scene,id)).filter((node):node is VisualNode=>!!node).map(node=>clone(node));
    setStatus("Copiado: "+clipboardRef.current.length+" elemento(s)");
  }
  function cutSelection(){
    copySelection();
    deleteSelection();
  }
  function pasteSelection(){
    if(!clipboardRef.current.length)return;
    let next=scene;
    const ids:string[]=[];
    for(const original of clipboardRef.current){
      const node=clone(original) as any;
      node.id=uid(original.type);
      node.zIndex=zMax(next)+1;
      if(typeof node.x==="number"){node.x+=24;node.y+=24;}
      if(typeof node.cx==="number"){node.cx+=24;node.cy+=24;}
      if(typeof node.x1==="number"){node.x1+=24;node.x2+=24;node.y1+=24;node.y2+=24;}
      if(Array.isArray(node.points))node.points=node.points.map(([x,y]:[number,number])=>[x+24,y+24]);
      next=addNode(next,node);
      ids.push(node.id);
    }
    commit(next,"Pegar selección");setSelectedIds(ids);
  }

  function deleteSelection(){
    if(!selectedIds.length)return;
    let next=scene;
    for(const id of selectedIds){
      const node=findNode(next,id);
      const assetId=node?.metadata?.assetId;
      if(assetId)AssetRuntime.recordAssetUsage({assetId:String(assetId),inserted:false,removed:true,kept:false});
      next=removeNode(next,id);
    }
    commit(next,"Eliminar "+selectedIds.length+" elemento(s)");
    setSelectedIds([]);
  }
  function duplicateSelection(){
    if(!selectedIds.length)return;
    const result=duplicateNodes(scene,selectedIds,{x:24,y:24});
    commit(result.scene,"Duplicar selección");setSelectedIds(result.ids);
  }
  function groupSelection(){
    if(selectedIds.length<2)return;
    const id=uid("group");
    commit(groupNodes(scene,selectedIds,id),"Agrupar selección");setSelectedIds([id]);
  }
  function ungroupSelection(){
    if(selectedIds.length!==1)return;
    const node=findNode(scene,selectedIds[0]!);
    if(node?.type!=="group")return;
    const children=node.children.map(child=>child.id);
    commit(ungroupNode(scene,node.id),"Desagrupar");setSelectedIds(children);
  }
  function align(mode:AlignMode){if(selectedIds.length>1)commit(alignNodes(scene,selectedIds,mode),"Alinear "+mode);}
  function distribute(mode:DistributeMode){if(selectedIds.length>2)commit(distributeNodes(scene,selectedIds,mode),"Distribuir "+mode);}

  function addPreset(node:VisualNode,label:string){
    const withZ={...node,zIndex:zMax(scene)+1} as VisualNode;
    const next=addNode(scene,withZ);commit(next,label);setSelectedIds([withZ.id]);setTool("select");
  }
  function addFormula(){
    const latex=window.prompt("LaTeX / ecuación","\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}");
    if(!latex)return;
    addPreset({id:uid("math"),type:"math",x:180,y:220,latex,scale:1,paint:{fill:"#0f172a"}},"Agregar fórmula");
  }
  function addTable(){addPreset(makeTable(scene),"Agregar tabla");}
  function addTriangle(){addPreset(makeTriangle(),"Agregar triángulo");}
  function addStar(){addPreset(makeStar(),"Agregar estrella");}

  function addImageUrl(){
    const href=window.prompt("URL o data URL de la imagen","https://");
    if(!href?.trim())return;
    addPreset({id:uid("image"),type:"image",x:140,y:150,width:420,height:280,href:href.trim(),fit:"contain",metadata:{imageAdjustments:{brightness:0,contrast:0,saturation:0,grayscale:0,blur:0,opacity:1}}},"Agregar imagen por URL");
  }

  async function addImageFile(file:File){
    const dataUrl=await new Promise<string>((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);
    });
    const size=await new Promise<{w:number;h:number}>((resolve)=>{
      const image=new Image();image.onload=()=>resolve({w:image.naturalWidth||400,h:image.naturalHeight||300});image.onerror=()=>resolve({w:400,h:300});image.src=dataUrl;
    });
    const max=420,ratio=Math.min(1,max/Math.max(size.w,size.h));
    addPreset({
      id:uid("image"),type:"image",x:140,y:150,width:Math.max(40,size.w*ratio),height:Math.max(40,size.h*ratio),href:dataUrl,fit:"contain",
      metadata:{imageAdjustments:{brightness:0,contrast:0,saturation:0,grayscale:0,blur:0,opacity:1}}
    },"Agregar imagen");
  }

  function insertAsset(asset:any){
    const node=assetPreviewNode(asset,scene);
    AssetRuntime.recordAssetUsage({assetId:String(asset.id),inserted:true,kept:true,edits:0});
    addPreset(node,"Insertar asset "+String(asset.name||asset.id));
  }

  function patchSelected(patch:Record<string,unknown>,label:string){
    if(!selected)return;
    commit(updateNode(scene,selected.id,patch),label);
  }
  function patchPaint(key:string,value:unknown){
    if(!selected)return;
    patchSelected({paint:{...(selected.paint||{}),[key]:value}},"Editar "+key);
  }
  function patchMetadata(patch:Record<string,unknown>,label:string){
    if(!selected)return;
    patchSelected({metadata:{...(selected.metadata||{}),...patch}},label);
  }

  function newDocument(){
    const page=createScene({id:uid("page"),width:1200,height:800,background:"#ffffff",nodes:[]});
    page.metadata={...(page.metadata||{}),learningRunId:"run-"+crypto.randomUUID()};
    const next=createDocument(uid("document"),[page]);
    setDocument(next);setPageIndex(0);historyRef.current.reset(page);setSelectedIds([]);setStatus("Documento nuevo");
    void enqueueLearningEvent({type:"document.created",source:"visual-studio",runId:runIdFor(page),sceneId:page.id,skill:firstSkill(page),payload:{document:next}});
    void saveVisualDocument(next);
  }

  function exportDocumentJson(){
    const blob=new Blob([JSON.stringify(document,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=window.document.createElement("a");a.href=url;a.download=(document.title||document.id||"visual-document")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
    void enqueueLearningEvent({type:"export.document-json",source:"visual-studio",runId:runIdFor(scene),sceneId:scene.id,skill:firstSkill(scene),payload:{sizeBytes:blob.size,document}});
    setStatus("Documento JSON exportado");
  }

  async function importJsonFile(file:File){
    const raw=await file.text();
    const parsed=JSON.parse(raw);
    let nextDoc:VisualDocument;
    if(parsed?.version==="1.0"&&Array.isArray(parsed.pages)){
      nextDoc=parsed as VisualDocument;
    }else if(parsed?.version==="1.0"&&Array.isArray(parsed.nodes)){
      nextDoc=createDocument(uid("document"),[parsed as VisualScene]);
    }else throw new Error("Archivo VisualScene/VisualDocument no válido");
    const imported=nextDoc.pages[0]||DEFAULT_SCENE;
    setDocument(nextDoc);setPageIndex(0);historyRef.current.reset(imported);setSelectedIds([]);
    await enqueueLearningEvent({type:"document.imported",source:"visual-studio",runId:runIdFor(imported),sceneId:imported.id,skill:firstSkill(imported),payload:{document:nextDoc,fileName:file.name,sizeBytes:file.size}});
    await saveVisualDocument(nextDoc);setStatus("Documento importado");
  }

  function resizeCanvas(width:number,height:number){
    const next={...scene,width:Math.max(100,Math.round(width)),height:Math.max(100,Math.round(height))};
    commit(next,"Cambiar tamaño de canvas");
  }

  function setPage(index:number){
    const page=document.pages[index];if(!page)return;
    setPageIndex(index);historyRef.current.reset(page);setSelectedIds([]);setStatus("Página "+(index+1));
    void refreshVersions(page.id);
  }
  function addNewPage(){
    const page=createScene({id:uid("page"),width:scene.width,height:scene.height,background:"#ffffff",nodes:[]});
    const next=clone(document);next.pages.push(page);setDocument(next);setPageIndex(next.pages.length-1);historyRef.current.reset(page);
    void enqueueLearningEvent({type:"document.page-added",source:"visual-studio",runId:runIdFor(scene),sceneId:page.id,skill:firstSkill(scene),payload:{documentId:next.id,pageIndex:next.pages.length-1,page}});
    void saveVisualDocument(next);setSelectedIds([]);setStatus("Página agregada");
  }
  function duplicatePage(){
    const page=clone(scene);page.id=uid("page");page.title=(page.title||"Página")+" copia";
    const next=clone(document);next.pages.splice(pageIndex+1,0,page);setDocument(next);setPageIndex(pageIndex+1);historyRef.current.reset(page);
    void saveVisualDocument(next);setStatus("Página duplicada");
  }
  function deletePage(){
    if(document.pages.length<=1)return;
    const removed=clone(scene);
    const next=clone(document);next.pages.splice(pageIndex,1);const idx=Math.max(0,pageIndex-1);setDocument(next);setPageIndex(idx);historyRef.current.reset(next.pages[idx]!);
    void enqueueLearningEvent({type:"document.page-deleted",source:"visual-studio",runId:runIdFor(scene),sceneId:scene.id,skill:firstSkill(scene),payload:{documentId:next.id,pageIndex,scene:removed}});
    void saveVisualDocument(next);setSelectedIds([]);setStatus("Página eliminada");
  }

  function restoreVersion(version:any){
    if(!version?.scene)return;
    const next=clone(version.scene) as VisualScene;historyRef.current.reset(next);
    const nextDoc=updatePage(next);setSelectedIds([]);setStatus("Versión restaurada");
    void saveVisualDocument(nextDoc);void saveLocalScene(next);
  }

  const adjustments=(selected?.type==="image"?(selected.metadata?.imageAdjustments||{}):{}) as any;
  const selectedTransform=selected?.transform||{};

  return <main className="suiteShell">
    <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void addImageFile(file);e.currentTarget.value="";}}/>
    <input ref={jsonInputRef} hidden type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void importJsonFile(file).catch(err=>setStatus(String(err)));e.currentTarget.value="";}}/>

    <header className="suiteTopbar">
      <div className="suiteBrand"><span className="eyebrow">INNOVA VISUAL STUDIO V4</span><strong>Editor completo</strong></div>
      <div className="suiteTopActions">
        <button onClick={newDocument}>Nuevo</button>
        <button onClick={()=>jsonInputRef.current?.click()}>Abrir JSON</button>
        <button onClick={exportDocumentJson}>Guardar JSON</button>
        <button onClick={undo}>↶ Deshacer</button>
        <button onClick={redo}>↷ Rehacer</button>
        <button onClick={()=>setZoom(v=>Math.max(.25,v-.1))}>−</button>
        <span>{Math.round(zoom*100)}%</span>
        <button onClick={()=>setZoom(v=>Math.min(2,v+.1))}>+</button>
        <button onClick={()=>setZoom(.72)}>Ajustar</button>
        <button onClick={()=>{void saveVisualDocument(document);void saveLocalScene(scene);setStatus("Guardado");}}>Guardar</button>
        <button className="editorPrimary" onClick={()=>{void saveVisualDocument(document);window.location.assign("/");}}>Guardar y volver</button>
        <span className="status"><span className="dot"/>{status}</span>
      </div>
    </header>

    <section className="suiteToolbar">
      <div className="toolGroup"><span>Seleccionar</span>
        <button className={tool==="select"?"active":""} onClick={()=>setTool("select")}>Puntero</button>
        <button className={tool==="hand"?"active":""} onClick={()=>setTool("hand")}>Mano</button>
      </div>
      <div className="toolGroup"><span>Paint</span>
        <button className={tool==="brush"?"active":""} onClick={()=>setTool("brush")}>Pincel</button>
        <button onClick={()=>selected&&patchPaint("fill",paint.fill)} disabled={!selected}>Balde</button>
        <button className={tool==="eraser"?"active":""} onClick={()=>setTool("eraser")}>Borrador</button>
        <button className={tool==="eyedropper"?"active":""} onClick={()=>setTool("eyedropper")}>Gotero</button>
      </div>
      <div className="toolGroup"><span>Formas</span>
        <button className={tool==="rect"?"active":""} onClick={()=>setTool("rect")}>Rect.</button>
        <button className={tool==="ellipse"?"active":""} onClick={()=>setTool("ellipse")}>Elipse</button>
        <button className={tool==="line"?"active":""} onClick={()=>setTool("line")}>Línea</button>
        <button className={tool==="arrow"?"active":""} onClick={()=>setTool("arrow")}>Flecha</button>
        <button onClick={addTriangle}>Triángulo</button>
        <button onClick={addStar}>Estrella</button>
      </div>
      <div className="toolGroup"><span>Insertar</span>
        <button className={tool==="text"?"active":""} onClick={()=>setTool("text")}>Texto</button>
        <button onClick={addFormula}>ƒx</button>
        <button onClick={addTable}>Tabla</button>
        <button onClick={()=>fileInputRef.current?.click()}>Imagen</button>
        <button onClick={addImageUrl}>Imagen URL</button>
      </div>
      <div className="toolGroup"><span>Vista</span>
        <button className={showGrid?"active":""} onClick={()=>setShowGrid(v=>!v)}>Cuadrícula</button>
      </div>
    </section>

    <section className="suiteLayout">
      <aside className="suiteLeft">
        <div className="suiteTabs">
          <button className={tab==="layers"?"active":""} onClick={()=>setTab("layers")}>Capas</button>
          <button className={tab==="assets"?"active":""} onClick={()=>setTab("assets")}>Assets</button>
          <button className={tab==="pages"?"active":""} onClick={()=>setTab("pages")}>Páginas</button>
          <button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Versiones</button>
        </div>

        {tab==="layers"&&<>
          <input className="suiteSearch" placeholder="Buscar capas…" value={layerQuery} onChange={e=>setLayerQuery(e.target.value)}/>
          <div className="layerActions">
            <button onClick={groupSelection} disabled={selectedIds.length<2}>Agrupar</button>
            <button onClick={ungroupSelection} disabled={selected?.type!=="group"}>Desagrupar</button>
            <button onClick={duplicateSelection} disabled={!selectedIds.length}>Duplicar</button>
            <button onClick={deleteSelection} disabled={!selectedIds.length}>Eliminar</button>
          </div>
          <div className="suiteLayerList">
            {layers.map(node=><div key={node.id} className={"suiteLayer "+(selectedIds.includes(node.id)?"selected":"")}>
              <button className="layerMain" onClick={e=>setSelectedIds(e.shiftKey?Array.from(new Set(selectedIds.concat(node.id))):[node.id])}>
                <small>{node.type}</small><strong>{nodeLabel(node)}</strong>
              </button>
              <button title="Mostrar/ocultar" onClick={()=>commit(updateNode(scene,node.id,{visible:node.visible===false?true:false}),"Visibilidad")}>{node.visible===false?"○":"●"}</button>
              <button title="Bloquear" onClick={()=>commit(updateNode(scene,node.id,{locked:!node.locked}),"Bloqueo")}>{node.locked?"🔒":"🔓"}</button>
            </div>)}
          </div>
        </>}

        {tab==="assets"&&<>
          <input className="suiteSearch" placeholder="Buscar assets…" value={assetQuery} onChange={e=>setAssetQuery(e.target.value)}/>
          <div className="assetGrid">
            {assets.map((asset:any)=><button key={asset.id} onClick={()=>insertAsset(asset)}>
              <span>{asset.category}</span><strong>{asset.name}</strong><small>{asset.id}</small>
            </button>)}
          </div>
        </>}

        {tab==="pages"&&<>
          <div className="pageActions"><button onClick={addNewPage}>+ Página</button><button onClick={duplicatePage}>Duplicar</button><button onClick={deletePage} disabled={document.pages.length<=1}>Eliminar</button></div>
          <div className="pageList">{document.pages.map((page,i)=><button className={i===pageIndex?"active":""} key={page.id} onClick={()=>setPage(i)}><strong>Página {i+1}</strong><span>{page.title||page.id}</span></button>)}</div>
        </>}

        {tab==="history"&&<>
          <button className="wideButton" onClick={()=>refreshVersions()}>Actualizar versiones</button>
          <div className="versionList">{versions.map(version=><button key={version.id} onClick={()=>restoreVersion(version)}><strong>{version.label}</strong><span>{new Date(version.createdAt).toLocaleString()}</span></button>)}</div>
        </>}
      </aside>

      <section className="suiteCenter">
        <div className="rulerTop">{Array.from({length:13},(_,i)=><span key={i}>{i*100}</span>)}</div>
        <div className="rulerLeft">{Array.from({length:9},(_,i)=><span key={i}>{i*100}</span>)}</div>
        <div className="konvaViewport">
          <KonvaSceneCanvas
            scene={scene} selectedIds={selectedIds} tool={tool} zoom={zoom} paint={paint}
            showGrid={showGrid}
            onSelectionChange={setSelectedIds}
            onCommit={commit}
            onStatus={setStatus}
            onPickColor={color=>setPaint(p=>({...p,fill:color,stroke:color}))}
          />
        </div>
        <div className="pageStrip">
          {document.pages.map((page,i)=><button key={page.id} className={i===pageIndex?"active":""} onClick={()=>setPage(i)}>{i+1}</button>)}
          <button onClick={addNewPage}>+</button>
        </div>
      </section>

      <aside className="suiteRight">
        <h2>Propiedades</h2>
        <section className="propSection">
          <h3>Documento / canvas</h3>
          <label>Fondo del canvas</label>
          <input type="color" value={String(scene.background||"#ffffff")} onChange={e=>commit({...scene,background:e.target.value},"Fondo del canvas")}/>
          <div className="fieldGrid">
            <label><span>Ancho</span><input type="number" value={scene.width} onChange={e=>resizeCanvas(Number(e.target.value),scene.height)}/></label>
            <label><span>Alto</span><input type="number" value={scene.height} onChange={e=>resizeCanvas(scene.width,Number(e.target.value))}/></label>
          </div>
          <div className="canvasPresets">
            <button onClick={()=>resizeCanvas(1200,800)}>1200×800</button>
            <button onClick={()=>resizeCanvas(1920,1080)}>16:9</button>
            <button onClick={()=>resizeCanvas(1080,1080)}>1:1</button>
            <button onClick={()=>resizeCanvas(1080,1920)}>9:16</button>
          </div>
        </section>

        {selectedIds.length>1&&<section className="propSection">
          <h3>{selectedIds.length} elementos seleccionados</h3>
          <div className="alignGrid">
            <button onClick={()=>align("left")}>←</button><button onClick={()=>align("center-x")}>↔</button><button onClick={()=>align("right")}>→</button>
            <button onClick={()=>align("top")}>↑</button><button onClick={()=>align("center-y")}>↕</button><button onClick={()=>align("bottom")}>↓</button>
          </div>
          <div className="miniActions"><button onClick={()=>distribute("horizontal")}>Distribuir H</button><button onClick={()=>distribute("vertical")}>Distribuir V</button></div>
          <button className="wideButton" onClick={groupSelection}>Agrupar</button>
        </section>}

        {selected&&<>
          <section className="propSection">
            <div className="nodeIdentity"><strong>{selected.id}</strong><span>{selected.type}</span></div>
            <label>Nombre de capa</label>
            <input className="fullInput" value={String(selected.metadata?.name||"")} placeholder={selected.id} onChange={e=>patchMetadata({name:e.target.value},"Renombrar capa")}/>
            <label>Enlace</label>
            <input className="fullInput" value={String(selected.metadata?.href||"")} placeholder="https://…" onChange={e=>patchMetadata({href:e.target.value,target:"_blank"},"Editar enlace")}/>
          </section>

          {selected.type==="text"&&<section className="propSection">
            <h3>Word · texto enriquecido</h3>
            <RichTextEditor
              html={String(selected.metadata?.richTextHtml||htmlFromText(selected.text))}
              onChange={value=>patchSelected({
                text:value.text,
                metadata:{...(selected.metadata||{}),richTextHtml:value.html,richText:true}
              },"Editar texto enriquecido")}
            />
            <div className="fieldGrid">
              <label><span>Tamaño</span><input type="number" value={String(selected.style?.size||16)} onChange={e=>patchSelected({style:{...(selected.style||{}),size:Number(e.target.value)}},"Tamaño de fuente")}/></label>
              <label><span>Peso</span><input type="number" value={String(Number(selected.style?.weight)||400)} onChange={e=>patchSelected({style:{...(selected.style||{}),weight:Number(e.target.value)}},"Peso de fuente")}/></label>
              <label><span>Ancho</span><input type="number" value={String(selected.maxWidth||300)} onChange={e=>patchSelected({maxWidth:Number(e.target.value)},"Ancho de texto")}/></label>
              <label><span>Interlínea</span><input type="number" step=".05" value={String(selected.style?.lineHeight||1.2)} onChange={e=>patchSelected({style:{...(selected.style||{}),lineHeight:Number(e.target.value)}},"Interlínea")}/></label>
            </div>
          </section>}

          {selected.type==="math"&&<section className="propSection">
            <h3>LaTeX / química</h3>
            <textarea className="code" rows={5} value={selected.latex} onChange={e=>patchSelected({latex:e.target.value,svg:undefined},"Editar fórmula")}/>
            <label>Escala</label><input className="fullInput" type="number" min=".2" max="5" step=".05" value={String(selected.scale||1)} onChange={e=>patchSelected({scale:Number(e.target.value)},"Escala fórmula")}/>
          </section>}

          {selected.type==="image"&&<section className="propSection">
            <h3>Paint · imagen</h3>
            <div className="miniActions"><button onClick={()=>setCropImage(selected)}>Recortar</button><button onClick={()=>patchSelected({transform:{...selectedTransform,rotation:(selectedTransform.rotation||0)+90}},"Rotar 90°")}>Rotar 90°</button></div>
            <div className="miniActions"><button onClick={()=>patchSelected({transform:{...selectedTransform,scaleX:-Math.abs(selectedTransform.scaleX??1)}},"Voltear horizontal")}>Voltear H</button><button onClick={()=>patchSelected({transform:{...selectedTransform,scaleY:-Math.abs(selectedTransform.scaleY??1)}},"Voltear vertical")}>Voltear V</button></div>
            {(["brightness","contrast","saturation","blur","grayscale","opacity"] as const).map(key=><label className="rangeField" key={key}><span>{key}</span><input type="range" min={key==="opacity"?0:key==="grayscale"?0:key==="blur"?0:-1} max={key==="opacity"||key==="grayscale"?1:key==="blur"?20:1} step={key==="blur"?1:.05} value={Number(adjustments[key]??(key==="opacity"?1:0))} onChange={e=>patchMetadata({imageAdjustments:{...adjustments,[key]:Number(e.target.value)}},"Ajuste "+key)}/><output>{Number(adjustments[key]??(key==="opacity"?1:0)).toFixed(2)}</output></label>)}
          </section>}

          <section className="propSection">
            <h3>Paint · apariencia</h3>
            <div className="paintGrid">
              <label><span>Relleno</span><input type="color" value={String(selected.paint?.fill||paint.fill).match(/^#[0-9a-f]{6}$/i)?String(selected.paint?.fill||paint.fill):paint.fill} onChange={e=>patchPaint("fill",e.target.value)}/></label>
              <label><span>Trazo</span><input type="color" value={String(selected.paint?.stroke||paint.stroke).match(/^#[0-9a-f]{6}$/i)?String(selected.paint?.stroke||paint.stroke):paint.stroke} onChange={e=>patchPaint("stroke",e.target.value)}/></label>
              <label><span>Grosor</span><input type="number" min="0" step=".5" value={String(selected.paint?.strokeWidth||0)} onChange={e=>patchPaint("strokeWidth",Number(e.target.value))}/></label>
            </div>
            <label className="rangeField"><span>Opacidad</span><input type="range" min="0" max="1" step=".05" value={Number(selected.paint?.opacity??1)} onChange={e=>patchPaint("opacity",Number(e.target.value))}/><output>{Number(selected.paint?.opacity??1).toFixed(2)}</output></label>
          </section>

          <section className="propSection">
            <h3>Transformar</h3>
            <div className="fieldGrid">
              <label><span>X</span><input type="number" value={String(selectedTransform.x||0)} onChange={e=>patchSelected({transform:{...selectedTransform,x:Number(e.target.value)}},"X")}/></label>
              <label><span>Y</span><input type="number" value={String(selectedTransform.y||0)} onChange={e=>patchSelected({transform:{...selectedTransform,y:Number(e.target.value)}},"Y")}/></label>
              <label><span>Rotación</span><input type="number" value={String(selectedTransform.rotation||0)} onChange={e=>patchSelected({transform:{...selectedTransform,rotation:Number(e.target.value)}},"Rotación")}/></label>
              <label><span>Escala X</span><input type="number" step=".05" value={String(selectedTransform.scaleX??1)} onChange={e=>patchSelected({transform:{...selectedTransform,scaleX:Number(e.target.value)}},"Escala X")}/></label>
            </div>
            <div className="miniActions"><button onClick={()=>commit(reorderNode(scene,selected.id,zMax(scene)+1),"Traer al frente")}>Al frente</button><button onClick={()=>commit(reorderNode(scene,selected.id,-1),"Enviar atrás")}>Al fondo</button></div>
            <div className="miniActions"><button onClick={duplicateSelection}>Duplicar</button><button onClick={()=>patchSelected({locked:!selected.locked},selected.locked?"Desbloquear":"Bloquear")}>{selected.locked?"Desbloquear":"Bloquear"}</button></div>
            <button className="dangerButton" onClick={deleteSelection}>Eliminar</button>
          </section>
        </>}
      </aside>
    </section>

    {cropImage&&<ImageCropper src={cropImage.href} onClose={()=>setCropImage(null)} onApply={dataUrl=>{
      patchSelected({href:dataUrl,metadata:{...(cropImage.metadata||{}),imageAdjustments:{brightness:0,contrast:0,saturation:0,grayscale:0,blur:0,opacity:1}}},"Recortar imagen");
      setCropImage(null);
    }}/>}
  </main>;
}
