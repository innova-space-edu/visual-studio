"use client";

import { useMemo, useRef, useState } from "react";
import { createScene, renderSvg, sceneAtTime, type VisualScene, type VisualTimeline } from "@innova-space/visual-engine";
import { VisualWorkerClient, offscreenCanvasAvailable } from "@innova-space/visual-engine/browser";
import {enqueueLearningEvent} from "@/lib/persistence";

const BASE=createScene({
  id:"runtime-demo",
  width:900,
  height:420,
  background:"#f8fafc",
  nodes:[
    {id:"track",type:"line",x1:90,y1:220,x2:810,y2:220,paint:{stroke:"#cbd5e1",strokeWidth:8,lineCap:"round"}},
    {id:"ball",type:"circle",cx:110,cy:220,r:34,paint:{fill:"#7c3aed",stroke:"#4c1d95",strokeWidth:3}},
    {id:"title",type:"text",x:60,y:72,text:"Deterministic animation timeline",style:{size:30,weight:800},paint:{fill:"#0f172a"}},
    {id:"caption",type:"text",x:60,y:360,text:"La escena se interpola como datos. No se generan cuadros con IA.",style:{size:18,weight:550},paint:{fill:"#475569"}}
  ]
});

const TIMELINE:VisualTimeline={
  duration:1800,
  loop:true,
  tracks:[
    {nodeId:"ball",property:"cx",keyframes:[
      {time:0,value:110,easing:"ease-in-out"},
      {time:900,value:790,easing:"ease-in-out"},
      {time:1800,value:110,easing:"ease-in-out"}
    ]},
    {nodeId:"ball",property:"transform.opacity",keyframes:[
      {time:0,value:.55},{time:900,value:1},{time:1800,value:.55}
    ]}
  ]
};

export default function RuntimeLab(){
  const [scene,setScene]=useState<VisualScene>(BASE);
  const [workerStatus,setWorkerStatus]=useState("No probado");
  const [benchmark,setBenchmark]=useState("—");
  const raf=useRef<number|null>(null);
  const svg=useMemo(()=>renderSvg(scene),[scene]);

  function play(){
    if(raf.current!==null)return;
    void enqueueLearningEvent({type:"runtime.timeline.play",source:"visual-studio",runId:"runtime-demo",sceneId:BASE.id,skill:"runtime.animation",payload:{duration:TIMELINE.duration,loop:TIMELINE.loop}});
    const start=performance.now();
    const tick=(now:number)=>{
      setScene(sceneAtTime(BASE,TIMELINE,now-start));
      raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);
  }

  function stop(){
    if(raf.current!==null)cancelAnimationFrame(raf.current);
    raf.current=null;
    setScene(BASE);
    void enqueueLearningEvent({type:"runtime.timeline.stop",source:"visual-studio",runId:"runtime-demo",sceneId:BASE.id,skill:"runtime.animation",payload:{}});
  }

  async function testWorker(){
    setWorkerStatus("Creando worker…");
    let client:VisualWorkerClient|null=null;
    try{
      client=new VisualWorkerClient();
      await client.ping();
      const started=performance.now();
      let last=0;
      for(let i=0;i<25;i++){
        const result=await client.renderSvg(sceneAtTime(BASE,TIMELINE,i*72));
        last=result.renderMs;
      }
      const elapsed=performance.now()-started;
      setWorkerStatus("Worker activo");
      setBenchmark(`25 renders: ${elapsed.toFixed(1)} ms · último ${last.toFixed(2)} ms`);
      void enqueueLearningEvent({type:"runtime.worker.benchmark",source:"visual-studio",runId:"runtime-demo",sceneId:BASE.id,skill:"runtime.worker",payload:{ok:true,renders:25,elapsedMs:elapsed,lastRenderMs:last,offscreenCanvas:offscreenCanvasAvailable()}});
    }catch(error){
      setWorkerStatus("Worker no disponible");
      setBenchmark(String(error));
      void enqueueLearningEvent({type:"runtime.worker.benchmark",source:"visual-studio",runId:"runtime-demo",sceneId:BASE.id,skill:"runtime.worker",payload:{ok:false,error:String(error),offscreenCanvas:offscreenCanvasAvailable()}});
    }finally{
      client?.terminate();
    }
  }

  return <section className="runtimeLab">
    <div className="threeHeader">
      <div><span className="eyebrow">RUNTIME · OFF MAIN THREAD</span><h2>Workers + Timeline</h2></div>
      <div className="topActions">
        <button onClick={play}>Animar</button>
        <button onClick={stop}>Detener</button>
        <button onClick={testWorker}>Benchmark Worker</button>
      </div>
    </div>
    <div className="runtimeStage" dangerouslySetInnerHTML={{__html:svg}}/>
    <div className="runtimeStats">
      <div><span>Web Worker</span><strong>{workerStatus}</strong></div>
      <div><span>OffscreenCanvas</span><strong>{offscreenCanvasAvailable()?"Disponible":"No disponible"}</strong></div>
      <div><span>Benchmark</span><strong>{benchmark}</strong></div>
    </div>
  </section>;
}
