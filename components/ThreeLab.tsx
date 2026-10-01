"use client";

import { useEffect, useRef, useState } from "react";
import {enqueueLearningEvent} from "@/lib/persistence";

type RendererMode="auto"|"webgl2";

async function hasWebGpuAdapter(){
  try{
    const gpu=(navigator as any).gpu;
    if(!gpu||typeof gpu.requestAdapter!=="function")return false;
    const adapter=await gpu.requestAdapter();
    return !!adapter;
  }catch{return false;}
}

function cylinderBetween(THREE:any,a:any,b:any,radius=.09){
  const start=new THREE.Vector3(a.x,a.y,a.z);
  const end=new THREE.Vector3(b.x,b.y,b.z);
  const direction=new THREE.Vector3().subVectors(end,start);
  const length=direction.length();
  const geometry=new THREE.CylinderGeometry(radius,radius,length,24);
  const material=new THREE.MeshStandardMaterial({color:0x94a3b8,roughness:.45,metalness:.05});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
  return mesh;
}

async function buildThreeRuntime(canvas:HTMLCanvasElement,useWebGPU:boolean){
  const THREE:any=useWebGPU?await import("three/webgpu"):await import("three");
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0b1020);

  const camera=new THREE.PerspectiveCamera(42,1,.01,100);
  camera.position.set(4.4,2.9,6.4);
  camera.lookAt(0,0,0);

  scene.add(new THREE.HemisphereLight(0xffffff,0x172033,2.2));
  const key=new THREE.DirectionalLight(0xffffff,3.8);
  key.position.set(5,7,6);
  scene.add(key);
  const rim=new THREE.DirectionalLight(0x6ea8ff,1.5);
  rim.position.set(-5,2,-4);
  scene.add(rim);

  const oxygen={x:0,y:0,z:0};
  const bond=1.55;
  const half=104.5/2*Math.PI/180;
  const h1={x:-Math.sin(half)*bond,y:Math.cos(half)*bond,z:0};
  const h2={x: Math.sin(half)*bond,y:Math.cos(half)*bond,z:0};

  const oMat=new THREE.MeshStandardMaterial({color:0xef4444,roughness:.38,metalness:.06});
  const hMat=new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:.32,metalness:.02});

  const O=new THREE.Mesh(new THREE.SphereGeometry(.66,48,32),oMat);
  O.position.set(oxygen.x,oxygen.y,oxygen.z);
  scene.add(O);

  for(const p of [h1,h2]){
    const atom=new THREE.Mesh(new THREE.SphereGeometry(.42,40,28),hMat);
    atom.position.set(p.x,p.y,p.z);
    scene.add(atom);
    scene.add(cylinderBetween(THREE,oxygen,p,.105));
  }

  const axes=new THREE.AxesHelper(1.1);
  axes.position.set(-2.7,-1.55,-.8);
  scene.add(axes);

  const renderer:any=useWebGPU
    ?new THREE.WebGPURenderer({canvas,antialias:true})
    :new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"});

  if(useWebGPU&&typeof renderer.init==="function")await renderer.init();

  const controlsMod:any=await import("three/addons/controls/OrbitControls.js");
  const controls=new controlsMod.OrbitControls(camera,canvas);
  controls.enableDamping=true;
  controls.dampingFactor=.06;
  controls.minDistance=3.2;
  controls.maxDistance=12;

  let disposed=false;
  let raf=0;
  const resize=()=>{
    const width=Math.max(1,canvas.clientWidth||canvas.width);
    const height=Math.max(1,canvas.clientHeight||canvas.height);
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
  };
  const tick=()=>{
    if(disposed)return;
    resize();
    controls.update();
    renderer.render(scene,camera);
    raf=requestAnimationFrame(tick);
  };
  tick();

  return {
    mode:useWebGPU?"webgpu":"webgl2",
    dispose(){
      disposed=true;
      cancelAnimationFrame(raf);
      controls.dispose();
      scene.traverse((obj:any)=>{
        obj.geometry?.dispose?.();
        const material=obj.material;
        if(Array.isArray(material))material.forEach((m:any)=>m.dispose?.());
        else material?.dispose?.();
      });
      renderer.dispose?.();
    }
  };
}

export default function ThreeLab(){
  const ref=useRef<HTMLCanvasElement|null>(null);
  const runtime=useRef<any>(null);
  const [status,setStatus]=useState("Detectando GPU…");
  const [mode,setMode]=useState<RendererMode>("auto");
  const [canvasKey,setCanvasKey]=useState(0);

  useEffect(()=>{
    let cancelled=false;
    async function start(){
      if(!ref.current)return;
      runtime.current?.dispose?.();
      runtime.current=null;
      const wantsWebGPU=mode==="auto"&&await hasWebGpuAdapter();
      try{
        setStatus(wantsWebGPU?"Inicializando WebGPU…":"Inicializando WebGL2…");
        const next=await buildThreeRuntime(ref.current!,wantsWebGPU);
        if(cancelled){next.dispose();return;}
        runtime.current=next;
        setStatus(next.mode==="webgpu"?"WebGPU activo · arrastra para rotar":"WebGL2 activo · fallback local");
        void enqueueLearningEvent({type:"runtime.3d.renderer",source:"visual-studio",runId:"three-h2o",skill:"three.h2o",payload:{ok:true,renderer:next.mode,requestedMode:mode}});
      }catch(error){
        if(wantsWebGPU){
          void enqueueLearningEvent({type:"runtime.3d.renderer",source:"visual-studio",runId:"three-h2o",skill:"three.h2o",payload:{ok:false,renderer:"webgpu",fallback:"webgl2",error:String(error)}});
          setStatus("WebGPU falló; cambiando a WebGL2…");
          setMode("webgl2");
          setCanvasKey(value=>value+1);
          return;
        }
        setStatus("Renderer no disponible: "+String(error));
        void enqueueLearningEvent({type:"runtime.3d.renderer",source:"visual-studio",runId:"three-h2o",skill:"three.h2o",payload:{ok:false,renderer:"webgl2",error:String(error)}});
      }
    }
    start();
    return ()=>{cancelled=true;runtime.current?.dispose?.();runtime.current=null;};
  },[mode,canvasKey]);

  return <div className="threeLab">
    <div className="threeHeader">
      <div>
        <span className="eyebrow">VISUAL3D · LOCAL</span>
        <h2>Laboratorio H₂O · WebGPU / WebGL2</h2>
      </div>
      <button onClick={()=>{
        setMode(value=>value==="auto"?"webgl2":"auto");
        setCanvasKey(value=>value+1);
      }}>{mode==="auto"?"Forzar WebGL2":"Reintentar WebGPU"}</button>
    </div>
    <canvas key={canvasKey} ref={ref} className="threeCanvas" width={1000} height={650}/>
    <p className="threeStatus">{status}</p>
    <p className="muted">Molécula construida con geometría 3D local. Rotación, zoom y pan mediante OrbitControls; sin generación de imagen externa.</p>
  </div>;
}
