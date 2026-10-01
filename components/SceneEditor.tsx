"use client";

import { useMemo, useRef, useState } from "react";
import {
  SceneHistory,
  createScene,
  findNode,
  flattenNodes,
  removeNode,
  renderSvg,
  updateNode,
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

export default function SceneEditor(){
  const [scene,setScene]=useState<VisualScene>(START);
  const historyRef=useRef(new SceneHistory(START));
  const [selectedId,setSelectedId]=useState("title");
  const [status,setStatus]=useState("Editor local");
  const selected=useMemo(()=>findNode(scene,selectedId),[scene,selectedId]);
  const layers=useMemo(()=>flattenNodes(scene.nodes).slice().reverse(),[scene]);
  const svg=useMemo(()=>renderSvg(scene),[scene]);

  function commit(next:VisualScene,label:string){
    historyRef.current.commit(next,label);
    setScene(next);
    setStatus(label);
  }

  function patch(patch:Record<string,unknown>,label="Editar nodo"){
    if(!selected)return;
    commit(updateNode(scene,selected.id,patch),label);
  }

  function changeNumber(field:string,value:string){
    const number=Number(value);
    if(Number.isFinite(number))patch({[field]:number},`Editar ${field}`);
  }

  function changeText(value:string){
    if(selected?.type==="text")patch({text:value},"Editar texto");
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

  return <main className="editorShell">
    <header className="editorTopbar">
      <div><span className="eyebrow">VISUAL STUDIO · SCENE EDITOR</span><h1>Editor estructurado</h1></div>
      <div className="editorToolbar">
        <button onClick={undo}>Deshacer</button>
        <button onClick={redo}>Rehacer</button>
        <button onClick={()=>{navigator.clipboard?.writeText(JSON.stringify(scene,null,2));setStatus("Scene JSON copiado");}}>Copiar JSON</button>
        <span className="status"><span className="dot"/>{status}</span>
      </div>
    </header>

    <section className="editorGrid">
      <aside className="layersPanel">
        <h2>Capas</h2>
        <p className="muted">{layers.length} nodos editables</p>
        <div className="layersList">
          {layers.map(node=><button key={node.id} className={selectedId===node.id?"layerActive":""} onClick={()=>setSelectedId(node.id)}>
            <span>{node.type}</span><strong>{node.id}</strong>
          </button>)}
        </div>
      </aside>

      <section className="editorStageWrap">
        <div className="editorStage" dangerouslySetInnerHTML={{__html:svg}}/>
      </section>

      <aside className="propertyPanel">
        <h2>Propiedades</h2>
        {!selected&&<p className="muted">Selecciona un nodo.</p>}
        {selected&&<>
          <div className="nodeIdentity"><strong>{selected.id}</strong><span>{selected.type}</span></div>
          {selected.type==="text"&&<>
            <label>Texto</label>
            <textarea rows={5} value={selected.text} onChange={e=>changeText(e.target.value)}/>
          </>}
          <div className="fieldGrid">
            {numericFields(selected).map(field=><label className="propertyField" key={field}>
              <span>{field}</span>
              <input type="number" value={String((selected as any)[field]??0)} onChange={e=>changeNumber(field,e.target.value)}/>
            </label>)}
          </div>
          <label>Visible</label>
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
