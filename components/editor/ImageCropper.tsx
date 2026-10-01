"use client";

import {useEffect,useRef,useState} from "react";
import Cropper from "cropperjs";

export default function ImageCropper({
  src,onApply,onClose
}:{src:string;onApply:(dataUrl:string)=>void;onClose:()=>void;}){
  const host=useRef<HTMLDivElement|null>(null);
  const cropperRef=useRef<any>(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const container=host.current;
    if(!container)return;
    container.innerHTML="";
    const image=new Image();
    image.src=src;
    image.alt="Imagen para recortar";
    image.style.display="none";
    container.appendChild(image);
    let cropper:any=null;
    image.onload=()=>{
      cropper=new (Cropper as any)(image,{container});
      cropperRef.current=cropper;
    };
    return ()=>{
      cropperRef.current=null;
      try{cropper?.getCropperCanvas?.()?.remove?.();}catch{}
      container.innerHTML="";
    };
  },[src]);

  async function apply(){
    const cropper=cropperRef.current;
    const selection=cropper?.getCropperSelection?.();
    if(!selection)return;
    setBusy(true);
    try{
      const canvas=await selection.$toCanvas();
      onApply(canvas.toDataURL("image/png"));
    }finally{setBusy(false);}
  }

  return <div className="cropperOverlay">
    <div className="cropperDialog">
      <div className="cropperHeader">
        <div><span className="eyebrow">PAINT · RECORTE</span><h3>Recortar imagen</h3></div>
        <button onClick={onClose}>Cerrar</button>
      </div>
      <div ref={host} className="cropperHost"/>
      <div className="cropperActions">
        <button onClick={onClose}>Cancelar</button>
        <button className="editorPrimary" disabled={busy} onClick={apply}>{busy?"Procesando…":"Aplicar recorte"}</button>
      </div>
    </div>
  </div>;
}
