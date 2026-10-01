"use client";

import { useMemo, useState } from "react";
import { visual } from "@innova-space/visual-design";
import { compilePlanToScene, ENGINE_CAPABILITIES } from "@innova-space/visual-design/engine";
import {
  analyzeQuality,
  loadCanvasKit,
  loadThreeWebGPU,
  parseVisualDSL,
  renderSvg,
  type VisualScene
} from "@innova-space/visual-engine";
import { searchAssets } from "@innova-space/visual-assets";

type Mode="prompt"|"dsl"|"scene";

const DEFAULT_PROMPT="Crea una infografía educativa sobre conservación de la materia con tres secciones claras.";
const DEFAULT_DSL='CANVAS 1200x800\nBACKGROUND "#f8fafc"\nTITLE "Visual DSL"\nRECT 80 150 430 220\nTEXT 120 220 "Editable y determinista"\nARROW 530 260 760 260\nCIRCLE 880 260 90\nMATH 780 470 "x^2+y^2=r^2"';

const PRESETS=[
  {name:"Infografía",prompt:"Crea una infografía educativa sobre conservación de la materia con tres secciones claras."},
  {name:"Matemática",prompt:"Diagrama matemático de homotecia k=-2 con plano cartesiano y fórmula P'=O+k(P-O)."},
  {name:"Química",prompt:"Diagrama de química de una molécula de agua H2O y la ecuación 2H2 + O2 -> 2H2O."},
  {name:"Flujo",prompt:"Diagrama de flujo del proceso: solicitud, validación, render, control de calidad, exportación."}
];

function downloadBlob(data:BlobPart,type:string,name:string){
  const url=URL.createObjectURL(new Blob([data],{type:type}));
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  a.click();
  setTimeout(function(){URL.revokeObjectURL(url);},500);
}

export default function StudioClient(){
  const [mode,setMode]=useState<Mode>("prompt");
  const [prompt,setPrompt]=useState(DEFAULT_PROMPT);
  const [dsl,setDsl]=useState(DEFAULT_DSL);
  const [sceneText,setSceneText]=useState("");
  const [scene,setScene]=useState<VisualScene|null>(null);
  const [svg,setSvg]=useState("");
  const [status,setStatus]=useState("Listo");
  const [skia,setSkia]=useState("No cargado");
  const [gpu,setGpu]=useState("No probado");
  const [error,setError]=useState("");

  const quality=useMemo(function(){return scene?analyzeQuality(scene):null;},[scene]);
  const assets=useMemo(function(){return searchAssets(scene?"math":"").slice(0,4);},[scene]);

  async function refineSvg(next:VisualScene){
    try{
      const res=await fetch("/api/render",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({scene:next,format:"svg",math:true})
      });
      if(res.ok)setSvg(await res.text());
    }catch{}
  }

  async function compile(){
    setError("");
    setStatus("Compilando localmente");
    try{
      let next:VisualScene;
      if(mode==="dsl"){
        next=parseVisualDSL(dsl);
      }else if(mode==="scene"){
        next=JSON.parse(sceneText) as VisualScene;
      }else{
        const plan=visual.plan(prompt,{
          brief:{output:{format:"svg",width:1200,height:800,editable:true}}
        });
        next=compilePlanToScene(plan) as VisualScene;
      }
      setScene(next);
      setSceneText(JSON.stringify(next,null,2));
      setSvg(renderSvg(next));
      setStatus("Scene Graph generado · MathJax refinando");
      await refineSvg(next);
      setStatus("Render local listo");
    }catch(e){
      setError(String(e));
      setStatus("Error");
    }
  }

  async function exportPng(){
    if(!scene)return;
    setStatus("Rasterizando con resvg");
    const res=await fetch("/api/render",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({scene:scene,format:"png",math:true,pixelRatio:2})
    });
    if(!res.ok){
      setError("No fue posible rasterizar PNG.");
      setStatus("Error");
      return;
    }
    downloadBlob(await res.blob(),"image/png","visual-engine.png");
    setStatus("PNG exportado");
  }

  function exportSvg(){
    if(svg)downloadBlob(svg,"image/svg+xml","visual-engine.svg");
  }

  async function probeSkia(){
    setSkia("Cargando WASM local...");
    try{
      const CK:any=await loadCanvasKit(function(file:string){return "/wasm/"+file;});
      const canvas=document.getElementById("skiaProbe") as HTMLCanvasElement|null;
      if(!canvas)throw new Error("Canvas de prueba no disponible");
      const surface=CK.MakeCanvasSurface(canvas);
      if(!surface)throw new Error("No se pudo crear SkSurface");
      const paint=new CK.Paint();
      paint.setAntiAlias(true);
      paint.setColor(CK.Color4f(0.15,0.39,0.92,1));
      surface.drawOnce(function(c:any){
        c.clear(CK.Color4f(0.97,0.98,1,1));
        c.drawCircle(90,55,34,paint);
      });
      paint.delete();
      setSkia("CanvasKit/Skia WASM activo");
    }catch(e){
      setSkia("No disponible");
      setError(String(e));
    }
  }

  async function probeGpu(){
    try{
      const supported=typeof navigator!=="undefined"&&"gpu" in navigator;
      const mod:any=await loadThreeWebGPU();
      if(supported&&mod.WebGPURenderer)setGpu("Three WebGPU disponible");
      else if(mod.WebGPURenderer)setGpu("WebGPU no disponible · fallback WebGL2");
      else setGpu("Módulo Three cargado");
    }catch(e){
      setGpu("Error de WebGPU");
      setError(String(e));
    }
  }

  return <main className="shell">
    <header className="topbar">
      <div>
        <span className="eyebrow">INNOVA SPACE · LOCAL-FIRST</span>
        <h1>Visual Engine Studio</h1>
      </div>
      <div className="status"><span className="dot"/>{status}</div>
    </header>

    <section className="workspace">
      <aside className="sidebar">
        <h2>Entrada</h2>
        <div className="segmented">
          {(["prompt","dsl","scene"] as Mode[]).map(function(x){
            return <button key={x} className={mode===x?"active":""} onClick={function(){setMode(x);}}>{x.toUpperCase()}</button>;
          })}
        </div>

        {mode==="prompt"&&<>
          <label>Solicitud</label>
          <textarea value={prompt} onChange={function(e){setPrompt(e.target.value);}} rows={10}/>
          <label>Pruebas</label>
          <div className="presetGrid">
            {PRESETS.map(function(p){
              return <button key={p.name} onClick={function(){setPrompt(p.prompt);}}>{p.name}</button>;
            })}
          </div>
        </>}

        {mode==="dsl"&&<>
          <label>Visual DSL</label>
          <textarea className="code" value={dsl} onChange={function(e){setDsl(e.target.value);}} rows={18}/>
        </>}

        {mode==="scene"&&<>
          <label>VisualScene 1.0</label>
          <textarea className="code" value={sceneText} onChange={function(e){setSceneText(e.target.value);}} rows={18}/>
        </>}

        <button className="primary" onClick={compile}>Compilar y renderizar</button>
        {error&&<p className="error">{error}</p>}
      </aside>

      <section className="stagePanel">
        <div className="panelHeader">
          <div><span className="eyebrow">RENDER</span><h2>Canvas 1200 × 800</h2></div>
          <div className="actions">
            <button onClick={exportSvg} disabled={!svg}>SVG</button>
            <button onClick={exportPng} disabled={!scene}>PNG 2×</button>
          </div>
        </div>

        <div className="stage">
          {svg
            ?<div className="svgPreview" dangerouslySetInnerHTML={{__html:svg}}/>
            :<div className="empty">Genera una escena para iniciar las pruebas.</div>}
        </div>

        <div className="techRow">
          <button onClick={probeSkia}>Probar Skia</button>
          <span>{skia}</span>
          <canvas id="skiaProbe" width="180" height="110"/>
          <button onClick={probeGpu}>Probar WebGPU</button>
          <span>{gpu}</span>
        </div>
      </section>

      <aside className="inspector">
        <h2>Inspector</h2>
        <div className="metricGrid">
          <div><span>Calidad</span><strong>{quality?quality.score:"—"}</strong></div>
          <div><span>Nodos</span><strong>{quality?quality.metrics.nodeCount:"—"}</strong></div>
          <div><span>Fuera</span><strong>{quality?quality.metrics.outOfBounds:"—"}</strong></div>
          <div><span>Duplicados</span><strong>{quality?quality.metrics.duplicateIds:"—"}</strong></div>
        </div>

        <h3>Contrato</h3>
        <code>{ENGINE_CAPABILITIES.contract}</code>
        <p className="muted">Planificación externa: 0 llamadas. Render estructurado local y editable.</p>

        <h3>Capacidades iniciales</h3>
        <div className="chips">
          {ENGINE_CAPABILITIES.initial_compilers.map(function(x:string){return <span key={x}>{x}</span>;})}
        </div>

        <h3>Assets semánticos</h3>
        <div className="assetList">
          {assets.map(function(a:any){return <div key={a.id}><strong>{a.name}</strong><small>{a.id}</small></div>;})}
        </div>

        <h3>Scene JSON</h3>
        <pre>{scene?JSON.stringify(scene,null,2).slice(0,6000):"Sin escena"}</pre>
      </aside>
    </section>
  </main>;
}
