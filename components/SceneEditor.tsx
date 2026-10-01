"use client";

import { useMemo, useRef, useState } from "react";
import {
  SceneHistory,
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

const START=createScene({
  id:"editor-demo",
  width:1200,
  height:800,
  background:"#f8fafc",
  title:"Visual Studio Editor",
  nodes:[
    {id:"title",type:"text",x:72,y:92,text:"Visual Studio Editor",style:{size:42,weight:800},paint:{fill:"#0f172a"}},
    {id:"card-a",type:"rect",x:72,y:150,width:330,height:210,rx:24,paint:{fill:"#dbeafe",stroke:"#2563eb",strokeWidth:2}},
    {id:"card-a-text",type:"text",x:108,y:220,text:"Selecciona una capa\ny edita sus propiedades.",style:{size:22,weight:650,lineHeight:1.35},paint:{fill:"#1e3a8a"}},
    {id:"arrow",type:"line",x1:430,y1:255,x2:700,y2:255,markerEnd:true,paint:{stroke:"#334155",strokeWidth:3}},
    {id:"circle",type:"circle",cx:820,cy:255,r:90,paint:{fill:"#ede9fe",stroke:"#7c3aed",strokeWidth:3}},
    {id:"caption",type:"text",x:690,y:430,text:"Scene Graph editable · sin IA",style:{size:24,weight:700},paint:{fill:"#334155"}}
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
  const sx=(value:number)=>snapValue(value,8,4);
  if(node.type==="text"||node.type==="math"||node.type==="rect"||node.type==="image"){
    return updateNode(scene,id,{x:sx(node.x+dx),y:sx(node.y+dy)});
  }
  if(node.type==="circle"||node.type==="ellipse"){
    return updateNode(scene,id,{cx:sx(node.cx+dx),cy:sx(node.cy+dy)});
  }
  if(node.type==="line"){
    return updateNode(scene,id,{
      x1:sx(node.x1+dx),y1:sx(node.y1+dy),
      x2:sx(node.x2+dx),y2:sx(node.y2+dy)
    });
  }
  if(node.type==="polygon"||node.type==="polyline"){
    return updateNode(scene,id,{points:node.points.map(([x,y])=>[sx(x+dx),sx(y+dy)])});
  }
  const transform=node.transform||{};
  return updateNode(scene,id,{transform:{...transform,x:sx((transform.x||0)+dx),y:sx((transform.y||0)+dy)}});
}

function selectionSvg(scene:VisualScene,selected:VisualNode|null){
  const svg=renderSvg(scene);
  if(!selected)return svg;
  const box=boundsOf(selected);
  if(!box)return svg;
  const pad=8;
  const overlay='<g id="__selection" pointer-events="none">'+
    '<rect x="'+(box.x-pad)+'" y="'+(box.y-pad)+'" width="'+(box.width+pad*2)+'" height="'+(box.height+pad*2)+'" rx="7" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="8 6"/>'+
    '<circle cx="'+(box.x+box.width)+'" cy="'+(box.y+box.height)+'" r="7" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>'+
    '</g>';
  return svg.replace("</svg>",overlay+"</svg>");
}

function isHex(value:unknown):value is string{
  return typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value);
}

export default function SceneEditor(){
  const [scene,setScene]=useState<VisualScene>(START);
  const historyRef=useRef(new SceneHistory(START));
  const dragRef=useRef<null|{id:string;startX:number;startY:number;base:VisualScene;preview:VisualScene}>(null);
  const [selectedId,setSelectedId]=useState("title");
  const [status,setStatus]=useState("Editor local");
  const [zoom,setZoom]=useState(.82);

  const selected=useMemo(()=>findNode(scene,selectedId),[scene,selectedId]);
  const layers=useMemo(()=>flattenNodes(scene.nodes).slice().sort((a,b)=>(b.zIndex||0)-(a.zIndex||0)),[scene]);
  const svg=useMemo(()=>selectionSvg(scene,selected),[scene,selected]);

  function commit(next:VisualScene,label:string){
    historyRef.current.commit(next,label);
    setScene(next);
    setStatus(label);
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
    if(selected?.type==="text")patch({text:value},"Editar texto");
  }

  function changePaint(key:keyof Paint,value:string|number){
    if(!selected)return;
    patch({paint:{...(selected.paint||{}),[key]:value}},`Editar ${key}`);
  }

  function removeSelected(){
    if(!selected)return;
    const next=removeNode(scene,selected.id);
    historyRef.current.commit(next,"Eliminar nodo");
    setScene(next);
    setSelectedId(flattenNodes(next.nodes)[0]?.id??"");
    setStatus("Nodo eliminado");
  }

  function undo(){
    const next=historyRef.current.undo();
    setScene(next);
    if(selectedId&&!findNode(next,selectedId))setSelectedId(flattenNodes(next.nodes)[0]?.id??"");
    setStatus("Deshacer");
  }

  function redo(){
    const next=historyRef.current.redo();
    setScene(next);
    setStatus("Rehacer");
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
    const id=candidate?.id;
    if(!id||id.startsWith("__")||!findNode(scene,id))return;
    setSelectedId(id);
    const node=findNode(scene,id);
    if(node?.locked){setStatus("Capa bloqueada");return;}
    const point=scenePoint(event);
    if(!point)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current={id,startX:point.x,startY:point.y,base:scene,preview:scene};
    setStatus("Arrastrando "+id);
  }

  function pointerMove(event:React.PointerEvent<HTMLDivElement>){
    const drag=dragRef.current;
    if(!drag)return;
    const point=scenePoint(event);
    if(!point)return;
    const next=moveNode(drag.base,drag.id,point.x-drag.startX,point.y-drag.startY);
    drag.preview=next;
    setScene(next);
  }

  function pointerUp(event:React.PointerEvent<HTMLDivElement>){
    const drag=dragRef.current;
    if(!drag)return;
    dragRef.current=null;
    try{event.currentTarget.releasePointerCapture(event.pointerId);}catch{}
    historyRef.current.commit(drag.preview,"Mover "+drag.id);
    setScene(drag.preview);
    setStatus("Posición actualizada · snap 8 px");
  }

  return <main className="editorShell">
    <header className="editorTopbar">
      <div><span className="eyebrow">VISUAL STUDIO · SCENE EDITOR</span><h1>Editor estructurado</h1></div>
      <div className="editorToolbar">
        <button onClick={undo}>Deshacer</button>
        <button onClick={redo}>Rehacer</button>
        <button onClick={()=>setZoom(value=>Math.max(.4,value-.1))}>−</button>
        <span className="zoomLabel">{Math.round(zoom*100)}%</span>
        <button onClick={()=>setZoom(value=>Math.min(1.8,value+.1))}>+</button>
        <button onClick={()=>setZoom(.82)}>Ajustar</button>
        <button onClick={()=>{navigator.clipboard?.writeText(JSON.stringify(scene,null,2));setStatus("Scene JSON copiado");}}>Copiar JSON</button>
        <span className="status"><span className="dot"/>{status}</span>
      </div>
    </header>

    <section className="editorGrid">
      <aside className="layersPanel">
        <h2>Capas</h2>
        <p className="muted">{layers.length} nodos · selecciona o arrastra en el canvas</p>
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
        {!selected&&<p className="muted">Selecciona un nodo.</p>}
        {selected&&<>
          <div className="nodeIdentity"><strong>{selected.id}</strong><span>{selected.type}</span></div>

          {selected.type==="text"&&<>
            <label>Texto</label>
            <textarea rows={4} value={selected.text} onChange={e=>changeText(e.target.value)}/>
            <div className="fieldGrid">
              <label className="propertyField"><span>Tamaño</span><input type="number" value={String(selected.style?.size??16)} onChange={e=>patch({style:{...(selected.style||{}),size:Number(e.target.value)}},"Editar tamaño")}/></label>
              <label className="propertyField"><span>Peso</span><input type="number" value={String(Number(selected.style?.weight)||400)} onChange={e=>patch({style:{...(selected.style||{}),weight:Number(e.target.value)}},"Editar peso")}/></label>
            </div>
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

          <h3>Orden y bloqueo</h3>
          <div className="miniActions">
            <button onClick={()=>commit(reorderNode(scene,selected.id,(selected.zIndex||0)+1),"Subir capa")}>Subir</button>
            <button onClick={()=>commit(reorderNode(scene,selected.id,(selected.zIndex||0)-1),"Bajar capa")}>Bajar</button>
          </div>
          <button className="wideButton" onClick={()=>patch({locked:!selected.locked},selected.locked?"Desbloquear capa":"Bloquear capa")}>
            {selected.locked?"Desbloquear":"Bloquear"}
          </button>
          <button className="wideButton" onClick={()=>patch({visible:selected.visible===false?true:false},"Cambiar visibilidad")}>
            {selected.visible===false?"Mostrar":"Ocultar"}
          </button>
          <button className="dangerButton" onClick={removeSelected}>Eliminar nodo</button>

          <h3>JSON del nodo</h3>
          <pre>{JSON.stringify(selected,null,2)}</pre>
        </>}
      </aside>
    </section>
  </main>;
}
