"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SceneHistory,
  addNode,
  boundsOf,
  createScene,
  findNode,
  flattenNodes,
  removeNode,
  renderSvg,
  reorderNode,
  snapValue,
  updateNode,
  type Paint,
  type VisualNode,
  type VisualScene
} from "@innova-space/visual-engine";
import { loadLatestScene, saveLocalScene } from "@/lib/persistence";

const START=createScene({
  id:"editor-demo",
  width:1200,
  height:800,
  background:"#f8fafc",
  title:"Visual Studio Editor",
  nodes:[
    {id:"title",type:"text",x:72,y:92,text:"Visual Studio Editor",style:{size:42,weight:800},paint:{fill:"#0f172a"}},
    {id:"card-a",type:"rect",x:72,y:150,width:330,height:210,rx:24,paint:{fill:"#dbeafe",stroke:"#2563eb",strokeWidth:2}},
    {id:"card-a-text",type:"text",x:108,y:220,text:"Selecciona una capa\ny edita sus propiedades.",maxWidth:280,style:{size:22,weight:650,lineHeight:1.35},paint:{fill:"#1e3a8a"}},
    {id:"arrow",type:"line",x1:430,y1:255,x2:700,y2:255,markerEnd:true,paint:{stroke:"#334155",strokeWidth:3}},
    {id:"circle",type:"circle",cx:820,cy:255,r:90,paint:{fill:"#ede9fe",stroke:"#7c3aed",strokeWidth:3}},
    {id:"caption",type:"text",x:690,y:430,text:"Scene Graph editable · sin IA",maxWidth:360,style:{size:24,weight:700},paint:{fill:"#334155"}}
  ]
});

function numericFields(node:VisualNode){
  const fields:string[]=[];
  for(const key of ["x","y","width","height","cx","cy","r","rx","ry","x1","y1","x2","y2","zIndex"]){
    if(key in node)fields.push(key);
  }
  return fields;
}

function moveNode(scene:VisualScene,id:string,dx:number,dy:number){
  const node=findNode(scene,id);
  if(!node||node.locked)return scene;
  const snap=(value:number)=>snapValue(value,8,4);
  if(node.type==="text"||node.type==="math"||node.type==="rect"||node.type==="image"){
    return updateNode(scene,id,{x:snap(node.x+dx),y:snap(node.y+dy)});
  }
  if(node.type==="circle"||node.type==="ellipse"){
    return updateNode(scene,id,{cx:snap(node.cx+dx),cy:snap(node.cy+dy)});
  }
  if(node.type==="line"){
    return updateNode(scene,id,{
      x1:snap(node.x1+dx),y1:snap(node.y1+dy),
      x2:snap(node.x2+dx),y2:snap(node.y2+dy)
    });
  }
  if(node.type==="polygon"||node.type==="polyline"){
    return updateNode(scene,id,{points:node.points.map(([x,y])=>[snap(x+dx),snap(y+dy)])});
  }
  const transform=node.transform||{};
  return updateNode(scene,id,{transform:{...transform,x:snap((transform.x||0)+dx),y:snap((transform.y||0)+dy)}});
}

function resizeNode(scene:VisualScene,id:string,dx:number,dy:number,box:{x:number;y:number;width:number;height:number}){
  const node=findNode(scene,id);
  if(!node||node.locked)return scene;
  const anyNode:any=node;
  const width=Math.max(12,box.width+dx);
  const height=Math.max(12,box.height+dy);

  if(node.type==="rect"||node.type==="image"){
    return updateNode(scene,id,{width:snapValue(width,8,4),height:snapValue(height,8,4)});
  }
  if(node.type==="circle"){
    return updateNode(scene,id,{r:Math.max(4,snapValue((Math.max(width,height))/2,4,2))});
  }
  if(node.type==="ellipse"){
    return updateNode(scene,id,{rx:Math.max(4,snapValue(width/2,4,2)),ry:Math.max(4,snapValue(height/2,4,2))});
  }
  if(node.type==="line"){
    return updateNode(scene,id,{x2:snapValue(node.x2+dx,8,4),y2:snapValue(node.y2+dy,8,4)});
  }
  if(node.type==="text"){
    return updateNode(scene,id,{maxWidth:Math.max(40,snapValue(width,8,4))});
  }
  if(node.type==="math"){
    const ratio=Math.max(.2,Math.min(5,width/Math.max(1,box.width)));
    return updateNode(scene,id,{scale:Math.max(.2,Math.min(4,(node.scale??1)*ratio))});
  }
  if(node.type==="polygon"||node.type==="polyline"){
    const sx=width/Math.max(1,box.width),sy=height/Math.max(1,box.height);
    return updateNode(scene,id,{
      points:node.points.map(([x,y])=>[
        box.x+(x-box.x)*sx,
        box.y+(y-box.y)*sy
      ])
    });
  }
  return updateNode(scene,id,{transform:{...(anyNode.transform||{}),scaleX:width/Math.max(1,box.width),scaleY:height/Math.max(1,box.height)}});
}

function selectionSvg(scene:VisualScene,selected:VisualNode|null){
  const svg=renderSvg(scene);
  if(!selected)return svg;
  const box=boundsOf(selected);
  if(!box)return svg;
  const pad=8;
  const overlay='<g id="__selection">'+
    '<rect x="'+(box.x-pad)+'" y="'+(box.y-pad)+'" width="'+(box.width+pad*2)+'" height="'+(box.height+pad*2)+'" rx="7" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="8 6" pointer-events="none"/>'+
    '<circle id="__resize__'+selected.id+'" cx="'+(box.x+box.width+pad)+'" cy="'+(box.y+box.height+pad)+'" r="8" fill="#ffffff" stroke="#2563eb" stroke-width="2" pointer-events="all"/>'+
    '</g>';
  return svg.replace("</svg>",overlay+"</svg>");
}

function isHex(value:unknown):value is string{
  return typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value);
}

export default function SceneEditor(){
  const [scene,setScene]=useState<VisualScene>(START);
  const historyRef=useRef(new SceneHistory(START));
  const saveTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const dragRef=useRef<null|{
    id:string;
    mode:"move"|"resize";
    startX:number;
    startY:number;
    base:VisualScene;
    preview:VisualScene;
    box:{x:number;y:number;width:number;height:number}|null;
  }>(null);
  const [selectedId,setSelectedId]=useState("title");
  const [status,setStatus]=useState("Cargando última escena…");
  const [zoom,setZoom]=useState(.82);

  const selected=useMemo(()=>findNode(scene,selectedId),[scene,selectedId]);
  const layers=useMemo(()=>flattenNodes(scene.nodes).slice().sort((a,b)=>(b.zIndex||0)-(a.zIndex||0)),[scene]);
  const svg=useMemo(()=>selectionSvg(scene,selected),[scene,selected]);

  useEffect(()=>{
    let active=true;
    loadLatestScene().then(saved=>{
      if(!active)return;
      if(saved){
        setScene(saved);
        historyRef.current.reset(saved);
        setSelectedId(flattenNodes(saved.nodes)[0]?.id??"");
        setStatus("Vista previa editable · escena generada cargada");
      }else{
        setStatus("Vista previa editable · demo local");
      }
    }).catch(()=>setStatus("Vista previa editable · demo local"));
    return ()=>{active=false;if(saveTimerRef.current)clearTimeout(saveTimerRef.current);};
  },[]);

  function scheduleSave(next:VisualScene){
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    saveTimerRef.current=setTimeout(()=>{
      void saveLocalScene(next);
    },300);
  }

  function commit(next:VisualScene,label:string){
    historyRef.current.commit(next,label);
    setScene(next);
    scheduleSave(next);
    setStatus(label+" · guardado automático");
  }

  function patch(patchValue:Record<string,unknown>,label="Editar nodo"){
    if(!selected)return;
    commit(updateNode(scene,selected.id,patchValue),label);
  }

  function changeNumber(field:string,value:string){
    const number=Number(value);
    if(Number.isFinite(number))patch({[field]:number},`Editar ${field}`);
  }

  function changeText(value:string){
    if(selected?.type==="text")patch({text:value},"Editar texto/párrafo");
  }

  function changePaint(key:keyof Paint,value:string|number){
    if(!selected)return;
    patch({paint:{...(selected.paint||{}),[key]:value}},`Editar ${key}`);
  }

  async function saveNow(){
    await saveLocalScene(scene);
    setStatus("Escena guardada");
  }

  async function returnToStudio(){
    await saveLocalScene(scene);
    window.location.assign("/");
  }

  function duplicateSelected(){
    if(!selected)return;
    const copy:any=structuredClone(selected);
    copy.id=selected.id+"-copy-"+Date.now().toString(36).slice(-4);
    if(typeof copy.x==="number")copy.x+=24;
    if(typeof copy.y==="number")copy.y+=24;
    if(typeof copy.cx==="number")copy.cx+=24;
    if(typeof copy.cy==="number")copy.cy+=24;
    if(typeof copy.x1==="number"){copy.x1+=24;copy.x2+=24;}
    if(typeof copy.y1==="number"){copy.y1+=24;copy.y2+=24;}
    if(Array.isArray(copy.points))copy.points=copy.points.map(([x,y]:[number,number])=>[x+24,y+24]);
    const next=addNode(scene,copy as VisualNode);
    commit(next,"Duplicar "+selected.id);
    setSelectedId(copy.id);
  }

  function removeSelected(){
    if(!selected)return;
    const next=removeNode(scene,selected.id);
    historyRef.current.commit(next,"Eliminar nodo");
    setScene(next);
    scheduleSave(next);
    setSelectedId(flattenNodes(next.nodes)[0]?.id??"");
    setStatus("Nodo eliminado · guardado automático");
  }

  function undo(){
    const next=historyRef.current.undo();
    setScene(next);
    scheduleSave(next);
    if(selectedId&&!findNode(next,selectedId))setSelectedId(flattenNodes(next.nodes)[0]?.id??"");
    setStatus("Deshacer · guardado automático");
  }

  function redo(){
    const next=historyRef.current.redo();
    setScene(next);
    scheduleSave(next);
    setStatus("Rehacer · guardado automático");
  }

  function scenePoint(event:React.PointerEvent<HTMLDivElement>){
    const svgElement=event.currentTarget.querySelector("svg");
    if(!svgElement)return null;
    const rect=svgElement.getBoundingClientRect();
    return {
      x:(event.clientX-rect.left)*scene.width/rect.width,
      y:(event.clientY-rect.top)*scene.height/rect.height
    };
  }

  function pointerDown(event:React.PointerEvent<HTMLDivElement>){
    const target=event.target as Element;
    const candidate=target.closest("[id]");
    const rawId=candidate?.id||"";
    const resize=rawId.startsWith("__resize__");
    const id=resize?rawId.slice("__resize__".length):rawId;
    if(!id||id.startsWith("__")||!findNode(scene,id))return;

    setSelectedId(id);
    const node=findNode(scene,id);
    if(node?.locked){setStatus("Capa bloqueada");return;}
    const point=scenePoint(event);
    const box=node?boundsOf(node):null;
    if(!point)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current={
      id,
      mode:resize?"resize":"move",
      startX:point.x,
      startY:point.y,
      base:scene,
      preview:scene,
      box
    };
    setStatus(resize?"Redimensionando "+id:"Moviendo "+id);
  }

  function pointerMove(event:React.PointerEvent<HTMLDivElement>){
    const drag=dragRef.current;
    if(!drag)return;
    const point=scenePoint(event);
    if(!point)return;
    const dx=point.x-drag.startX,dy=point.y-drag.startY;
    const next=drag.mode==="resize"&&drag.box
      ?resizeNode(drag.base,drag.id,dx,dy,drag.box)
      :moveNode(drag.base,drag.id,dx,dy);
    drag.preview=next;
    setScene(next);
  }

  function pointerUp(event:React.PointerEvent<HTMLDivElement>){
    const drag=dragRef.current;
    if(!drag)return;
    dragRef.current=null;
    try{event.currentTarget.releasePointerCapture(event.pointerId);}catch{}
    historyRef.current.commit(drag.preview,(drag.mode==="resize"?"Redimensionar ":"Mover ")+drag.id);
    setScene(drag.preview);
    scheduleSave(drag.preview);
    setStatus((drag.mode==="resize"?"Tamaño":"Posición")+" actualizado · snap 8 px");
  }

  return <main className="editorShell">
    <header className="editorTopbar">
      <div>
        <span className="eyebrow">VISUAL STUDIO · VISTA PREVIA EDITABLE</span>
        <h1>Edita la escena generada completa</h1>
      </div>
      <div className="editorToolbar">
        <button onClick={undo}>Deshacer</button>
        <button onClick={redo}>Rehacer</button>
        <button onClick={()=>setZoom(value=>Math.max(.35,value-.1))}>−</button>
        <span className="zoomLabel">{Math.round(zoom*100)}%</span>
        <button onClick={()=>setZoom(value=>Math.min(2,value+.1))}>+</button>
        <button onClick={()=>setZoom(.82)}>Ajustar</button>
        <button onClick={saveNow}>Guardar</button>
        <button onClick={()=>{navigator.clipboard?.writeText(JSON.stringify(scene,null,2));setStatus("Scene JSON copiado");}}>Copiar JSON</button>
        <button className="editorPrimary" onClick={returnToStudio}>Guardar y volver</button>
        <span className="status"><span className="dot"/>{status}</span>
      </div>
    </header>

    <section className="editorGrid">
      <aside className="layersPanel">
        <h2>Capas</h2>
        <p className="muted">{layers.length} elementos editables. Haz clic en cualquier figura, texto o párrafo del canvas.</p>
        <div className="layersList">
          {layers.map(node=><button key={node.id} className={selectedId===node.id?"layerActive":""} onClick={()=>setSelectedId(node.id)}>
            <span>{node.type}{node.locked?" · 🔒":""}</span><strong>{node.id}</strong>
          </button>)}
        </div>
      </aside>

      <section className="editorStageWrap">
        <div
          className="editorStage interactiveStage"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
        >
          <div className="editorCanvasScale" style={{width:(zoom*100)+"%"}} dangerouslySetInnerHTML={{__html:svg}}/>
        </div>
      </section>

      <aside className="propertyPanel">
        <h2>Propiedades</h2>
        <div className="canvasProperties">
          <label>Fondo del canvas</label>
          <input type="color" value={isHex(scene.background)?scene.background:"#ffffff"} onChange={e=>commit({...scene,background:e.target.value},"Editar fondo")}/>
        </div>

        {!selected&&<p className="muted">Selecciona una figura, texto, párrafo, fórmula o línea.</p>}
        {selected&&<>
          <div className="nodeIdentity"><strong>{selected.id}</strong><span>{selected.type}</span></div>

          {selected.type==="text"&&<>
            <label>Texto / párrafo</label>
            <textarea rows={5} value={selected.text} onChange={e=>changeText(e.target.value)}/>
            <div className="fieldGrid">
              <label className="propertyField"><span>Tamaño</span><input type="number" value={String(selected.style?.size??16)} onChange={e=>patch({style:{...(selected.style||{}),size:Number(e.target.value)}},"Editar tamaño")}/></label>
              <label className="propertyField"><span>Peso</span><input type="number" value={String(Number(selected.style?.weight)||400)} onChange={e=>patch({style:{...(selected.style||{}),weight:Number(e.target.value)}},"Editar peso")}/></label>
              <label className="propertyField"><span>Interlínea</span><input type="number" min=".7" max="3" step=".05" value={String(selected.style?.lineHeight??1.2)} onChange={e=>patch({style:{...(selected.style||{}),lineHeight:Number(e.target.value)}},"Editar interlínea")}/></label>
              <label className="propertyField"><span>Ancho párrafo</span><input type="number" min="40" value={String(selected.maxWidth??300)} onChange={e=>patch({maxWidth:Number(e.target.value)},"Editar ancho del párrafo")}/></label>
            </div>
            <label>Alineación</label>
            <div className="alignmentButtons">
              {(["start","middle","end"] as const).map(value=><button key={value} className={selected.style?.align===value?"active":""} onClick={()=>patch({style:{...(selected.style||{}),align:value}},"Editar alineación")}>{value==="start"?"Izquierda":value==="middle"?"Centro":"Derecha"}</button>)}
            </div>
          </>}

          {selected.type==="math"&&<>
            <label>Fórmula LaTeX</label>
            <textarea className="code" rows={4} value={selected.latex} onChange={e=>patch({latex:e.target.value},"Editar fórmula")}/>
            <label>Escala</label>
            <input className="fullInput" type="number" min=".2" max="4" step=".05" value={String(selected.scale??1)} onChange={e=>patch({scale:Number(e.target.value)},"Editar escala de fórmula")}/>
          </>}

          <div className="fieldGrid">
            {numericFields(selected).map(field=><label className="propertyField" key={field}>
              <span>{field}</span>
              <input type="number" value={String((selected as any)[field]??0)} onChange={e=>changeNumber(field,e.target.value)}/>
            </label>)}
          </div>

          <h3>Apariencia</h3>
          <div className="paintGrid">
            <label><span>Relleno</span><input type="color" value={isHex(selected.paint?.fill)?selected.paint.fill:"#ffffff"} onChange={e=>changePaint("fill",e.target.value)}/></label>
            <label><span>Trazo</span><input type="color" value={isHex(selected.paint?.stroke)?selected.paint.stroke:"#334155"} onChange={e=>changePaint("stroke",e.target.value)}/></label>
            <label><span>Grosor</span><input type="number" min="0" step=".5" value={String(selected.paint?.strokeWidth??0)} onChange={e=>changePaint("strokeWidth",Number(e.target.value))}/></label>
          </div>

          <h3>Organización</h3>
          <div className="miniActions">
            <button onClick={()=>commit(reorderNode(scene,selected.id,(selected.zIndex||0)+1),"Subir capa")}>Subir</button>
            <button onClick={()=>commit(reorderNode(scene,selected.id,(selected.zIndex||0)-1),"Bajar capa")}>Bajar</button>
            <button onClick={duplicateSelected}>Duplicar</button>
            <button onClick={()=>patch({locked:!selected.locked},selected.locked?"Desbloquear capa":"Bloquear capa")}>{selected.locked?"Desbloquear":"Bloquear"}</button>
          </div>
          <button className="wideButton" onClick={()=>patch({visible:selected.visible===false?true:false},"Cambiar visibilidad")}>
            {selected.visible===false?"Mostrar":"Ocultar"}
          </button>
          <button className="dangerButton" onClick={removeSelected}>Eliminar elemento</button>

          <h3>JSON del elemento</h3>
          <pre>{JSON.stringify(selected,null,2)}</pre>
        </>}
      </aside>
    </section>
  </main>;
}
