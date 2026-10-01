"use client";

import { useEffect, useRef, useState } from "react";
import { axes3D, create3DScene, molecule3D } from "@innova-space/visual-engine";
import { renderThreeScene } from "@innova-space/visual-engine/browser";

const WATER=create3DScene({
  id:"water-3d",
  background:"#0b1020",
  camera:{position:{x:3.8,y:2.6,z:5.5},target:{x:0,y:0,z:0}},
  nodes:[
    ...axes3D("axes",1.8),
    ...molecule3D("water",[
      {symbol:"O",position:{x:0,y:0,z:0},radius:.52},
      {symbol:"H",position:{x:-.82,y:.58,z:0},radius:.34},
      {symbol:"H",position:{x:.82,y:.58,z:0},radius:.34}
    ],[
      {a:0,b:1},{a:0,b:2}
    ])
  ]
});

export default function ThreeLab(){
  const ref=useRef<HTMLCanvasElement|null>(null);
  const runtime=useRef<any>(null);
  const [status,setStatus]=useState("Inicializando WebGPU…");
  const [forceWebGL,setForceWebGL]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    async function start(){
      if(!ref.current)return;
      runtime.current?.dispose?.();
      try{
        setStatus(forceWebGL?"Inicializando WebGL2 fallback…":"Inicializando WebGPU…");
        const next=await renderThreeScene(ref.current,WATER,{forceWebGL,antialias:true});
        if(cancelled){next.dispose();return;}
        runtime.current=next;
        setStatus(forceWebGL?"Three.js · WebGL2 forzado":"Three.js · WebGPU automático");
      }catch(error){
        setStatus("Renderer no disponible: "+String(error));
      }
    }
    start();
    return ()=>{cancelled=true;runtime.current?.dispose?.();runtime.current=null;};
  },[forceWebGL]);

  return <div className="threeLab">
    <div className="threeHeader">
      <div><span className="eyebrow">VISUAL3D · LOCAL</span><h2>Laboratorio WebGPU</h2></div>
      <button onClick={()=>setForceWebGL(v=>!v)}>{forceWebGL?"Usar selección automática":"Forzar WebGL2"}</button>
    </div>
    <canvas ref={ref} className="threeCanvas" width={1000} height={650}/>
    <p className="muted">{status}</p>
    <p className="muted">La escena es serializable y programática. El ejemplo construye H₂O y ejes 3D sin generar una imagen con IA.</p>
  </div>;
}
