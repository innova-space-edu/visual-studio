"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import Konva from "konva";
import {
  Stage,Layer,Group,Rect,Circle,Ellipse,Line,Arrow,Text,Image as KonvaImage,Path,Transformer
} from "react-konva";
import {
  addNode,findNode,flattenNodes,removeNode,updateNode,
  type ImageNode,type MathNode,type VisualNode,type VisualScene
} from "@innova-space/visual-engine";

export type EditorTool="select"|"hand"|"brush"|"eraser"|"rect"|"ellipse"|"line"|"arrow"|"text"|"eyedropper";

export interface PaintSettings{
  fill:string;
  stroke:string;
  strokeWidth:number;
  opacity:number;
  brushSize:number;
}

interface Props{
  scene:VisualScene;
  selectedIds:string[];
  tool:EditorTool;
  zoom:number;
  paint:PaintSettings;
  onSelectionChange:(ids:string[])=>void;
  onCommit:(scene:VisualScene,label:string)=>void;
  onStatus:(status:string)=>void;
  onPickColor?:(color:string)=>void;
  showGrid?:boolean;
}

function sorted(nodes:VisualNode[]){
  return nodes.slice().sort((a,b)=>(a.zIndex||0)-(b.zIndex||0));
}
function uid(prefix:string){return prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6);}
function mapAlign(value:unknown) {
  return value==="middle"?"center":value==="end"?"right":"left";
}
function nodeTransform(node:VisualNode){
  const t=node.transform||{};
  return {
    x:t.x||0,y:t.y||0,rotation:t.rotation||0,
    scaleX:t.scaleX??1,scaleY:t.scaleY??1,opacity:t.opacity??node.paint?.opacity??1
  };
}

function useHtmlImage(src:string){
  const [image,setImage]=useState<HTMLImageElement|null>(null);
  useEffect(()=>{
    if(!src){setImage(null);return;}
    let active=true;
    const img=new window.Image();
    img.crossOrigin="anonymous";
    img.onload=()=>{if(active)setImage(img);};
    img.onerror=()=>{if(active)setImage(null);};
    img.src=src;
    return ()=>{active=false;};
  },[src]);
  return image;
}

function ImageShape({node}:{node:ImageNode}){
  const image=useHtmlImage(node.href);
  const ref=useRef<Konva.Image|null>(null);
  const adjustments=(node.metadata?.imageAdjustments||{}) as any;
  useEffect(()=>{
    const shape=ref.current;
    if(!shape||!image)return;
    const filters:any[]=[];
    if(Number(adjustments.brightness))filters.push(Konva.Filters.Brighten);
    if(Number(adjustments.contrast))filters.push(Konva.Filters.Contrast);
    if(Number(adjustments.saturation))filters.push(Konva.Filters.HSL);
    if(Number(adjustments.grayscale))filters.push(Konva.Filters.Grayscale);
    if(Number(adjustments.blur))filters.push(Konva.Filters.Blur);
    if(filters.length){
      shape.cache();
      shape.filters(filters);
      shape.brightness(Number(adjustments.brightness)||0);
      shape.contrast(Number(adjustments.contrast)||0);
      shape.saturation(Number(adjustments.saturation)||0);
      shape.blurRadius(Number(adjustments.blur)||0);
    }else{
      shape.clearCache();
      shape.filters([]);
    }
    shape.getLayer()?.batchDraw();
  },[image,adjustments.brightness,adjustments.contrast,adjustments.saturation,adjustments.grayscale,adjustments.blur]);

  const crop=adjustments.crop;
  return <KonvaImage
    ref={ref}
    image={image||undefined}
    x={node.x} y={node.y} width={node.width} height={node.height}
    crop={crop?{x:Number(crop.x)||0,y:Number(crop.y)||0,width:Number(crop.width)||node.width,height:Number(crop.height)||node.height}:undefined}
    opacity={Number.isFinite(adjustments.opacity)?Number(adjustments.opacity):undefined}
  />;
}

function MathShape({node}:{node:MathNode}){
  const [src,setSrc]=useState("");
  useEffect(()=>{
    let active=true;
    const color=typeof node.paint?.fill==="string"?node.paint.fill:"#0f172a";
    fetch("/api/math",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({latex:node.latex,color})})
      .then(r=>r.ok?r.text():Promise.reject(new Error("math "+r.status)))
      .then(svg=>{if(active)setSrc("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg));})
      .catch(()=>{if(active)setSrc("");});
    return ()=>{active=false;};
  },[node.latex,node.paint?.fill]);
  const image=useHtmlImage(src);
  if(!image)return <Text x={node.x} y={node.y-24} text={node.latex} fontSize={24} fill={String(node.paint?.fill||"#0f172a")}/>;
  const scale=node.scale??1;
  const width=(image.naturalWidth||300)*scale;
  const height=(image.naturalHeight||60)*scale;
  return <KonvaImage image={image} x={node.x} y={node.y-height*.72} width={width} height={height}/>;
}

function SceneNode({
  node,selected,selectable,onSelect,onTransformCommit
}:{
  node:VisualNode;selected:boolean;selectable:boolean;
  onSelect:(node:VisualNode,e:any)=>void;
  onTransformCommit:(node:VisualNode,group:Konva.Node,label:string)=>void;
}){
  if(node.visible===false)return null;
  const t=nodeTransform(node);
  const commonPaint:any={
    fill:node.paint?.fill,
    stroke:node.paint?.stroke,
    strokeWidth:node.paint?.strokeWidth,
    opacity:node.paint?.opacity,
    dash:node.paint?.dash,
    lineCap:node.paint?.lineCap,
    lineJoin:node.paint?.lineJoin
  };
  let content:React.ReactNode=null;
  if(node.type==="rect")content=<Rect x={node.x} y={node.y} width={node.width} height={node.height} cornerRadius={node.rx||0} {...commonPaint}/>;
  else if(node.type==="circle")content=<Circle x={node.cx} y={node.cy} radius={node.r} {...commonPaint}/>;
  else if(node.type==="ellipse")content=<Ellipse x={node.cx} y={node.cy} radiusX={node.rx} radiusY={node.ry} {...commonPaint}/>;
  else if(node.type==="line")content=node.markerEnd?<Arrow points={[node.x1,node.y1,node.x2,node.y2]} pointerLength={10} pointerWidth={9} {...commonPaint}/>:<Line points={[node.x1,node.y1,node.x2,node.y2]} {...commonPaint}/>;
  else if(node.type==="polyline"||node.type==="polygon")content=<Line points={node.points.flat()} closed={node.type==="polygon"} {...commonPaint}/>;
  else if(node.type==="path")content=<Path data={node.d} {...commonPaint}/>;
  else if(node.type==="text")content=<Text
    x={node.x} y={node.y-(node.style?.size||16)}
    text={node.text} width={node.maxWidth}
    fontFamily={node.style?.family||"Inter,Arial,sans-serif"}
    fontSize={node.style?.size||16}
    fontStyle={((Number(node.style?.weight)||400)>=600?"bold ":"")+(node.style?.style==="italic"?"italic":"")||"normal"}
    align={mapAlign(node.style?.align)}
    lineHeight={node.style?.lineHeight||1.2}
    letterSpacing={node.style?.letterSpacing||0}
    fill={String(node.paint?.fill||"#0f172a")}
    stroke={node.paint?.stroke} strokeWidth={node.paint?.strokeWidth||0}
  />;
  else if(node.type==="image")content=<ImageShape node={node}/>;
  else if(node.type==="math")content=<MathShape node={node}/>;
  else if(node.type==="group")content=<>{sorted(node.children).map(child=><SceneNode
    key={child.id} node={child} selected={false} selectable={false}
    onSelect={onSelect} onTransformCommit={onTransformCommit}
  />)}</>;

  return <Group
    id={node.id}
    name="visual-node"
    x={t.x} y={t.y} rotation={t.rotation} scaleX={t.scaleX} scaleY={t.scaleY}
    opacity={t.opacity}
    draggable={selectable&&!node.locked}
    listening={selectable}
    onPointerDown={(e)=>onSelect(node,e)}
    onTap={(e)=>onSelect(node,e)}
    onDragEnd={(e)=>onTransformCommit(node,e.currentTarget,"Mover "+node.id)}
    onTransformEnd={(e)=>onTransformCommit(node,e.currentTarget,"Transformar "+node.id)}
  >{content}</Group>;
}

function makeShape(tool:EditorTool,start:{x:number;y:number},end:{x:number;y:number},paint:PaintSettings):VisualNode|null{
  const x=Math.min(start.x,end.x),y=Math.min(start.y,end.y),w=Math.abs(end.x-start.x),h=Math.abs(end.y-start.y);
  if(tool==="rect")return {id:uid("rect"),type:"rect",x,y,width:Math.max(4,w),height:Math.max(4,h),rx:8,paint:{fill:paint.fill,stroke:paint.stroke,strokeWidth:paint.strokeWidth,opacity:paint.opacity}};
  if(tool==="ellipse")return {id:uid("ellipse"),type:"ellipse",cx:(start.x+end.x)/2,cy:(start.y+end.y)/2,rx:Math.max(2,w/2),ry:Math.max(2,h/2),paint:{fill:paint.fill,stroke:paint.stroke,strokeWidth:paint.strokeWidth,opacity:paint.opacity}};
  if(tool==="line"||tool==="arrow")return {id:uid(tool),type:"line",x1:start.x,y1:start.y,x2:end.x,y2:end.y,markerEnd:tool==="arrow",paint:{stroke:paint.stroke,strokeWidth:paint.strokeWidth,opacity:paint.opacity,lineCap:"round"}};
  return null;
}

export default function KonvaSceneCanvas(props:Props){
  const {scene,selectedIds,tool,zoom,paint,onSelectionChange,onCommit,onStatus,onPickColor,showGrid=false}=props;
  const stageRef=useRef<Konva.Stage|null>(null);
  const transformerRef=useRef<Konva.Transformer|null>(null);
  const [draft,setDraft]=useState<VisualNode|null>(null);
  const [drawStart,setDrawStart]=useState<{x:number;y:number}|null>(null);
  const [brushPoints,setBrushPoints]=useState<number[]>([]);
  const panning=tool==="hand";

  useEffect(()=>{
    const stage=stageRef.current,tr=transformerRef.current;
    if(!stage||!tr)return;
    const nodes=selectedIds.map(id=>stage.findOne("#"+id)).filter(Boolean) as Konva.Node[];
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  },[selectedIds,scene]);

  function pointer(){
    const stage=stageRef.current;
    const p=stage?.getPointerPosition();
    if(!p)return null;
    return {x:(p.x-stage!.x())/zoom,y:(p.y-stage!.y())/zoom};
  }

  function selectNode(node:VisualNode,e:any){
    if(tool==="eraser"){
      if(!node.locked)onCommit(removeNode(scene,node.id),"Borrar "+node.id);
      return;
    }
    if(tool==="eyedropper"){
      const color=String(node.paint?.fill||node.paint?.stroke||"#000000");
      onPickColor?.(color);onStatus("Color capturado: "+color);return;
    }
    if(tool!=="select")return;
    const multi=!!e.evt?.shiftKey;
    if(multi){
      const exists=selectedIds.includes(node.id);
      onSelectionChange(exists?selectedIds.filter(id=>id!==node.id):selectedIds.concat(node.id));
    }else onSelectionChange([node.id]);
    e.cancelBubble=true;
  }

  function commitTransform(node:VisualNode,group:Konva.Node,label:string){
    const next=updateNode(scene,node.id,{
      transform:{
        ...(node.transform||{}),
        x:group.x(),y:group.y(),rotation:group.rotation(),scaleX:group.scaleX(),scaleY:group.scaleY()
      }
    });
    onCommit(next,label);
  }

  function stageDown(e:any){
    if(e.target!==e.target.getStage())return;
    if(tool==="select"){onSelectionChange([]);return;}
    const p=pointer();if(!p)return;
    if(["rect","ellipse","line","arrow"].includes(tool)){setDrawStart(p);setDraft(makeShape(tool,p,p,paint));return;}
    if(tool==="brush"){setBrushPoints([p.x,p.y]);setDrawStart(p);return;}
    if(tool==="text"){
      const node:VisualNode={id:uid("text"),type:"text",x:p.x,y:p.y,text:"Nuevo texto",maxWidth:280,style:{size:24,weight:500,lineHeight:1.25},paint:{fill:paint.fill}};
      onCommit(addNode(scene,node),"Agregar texto");onSelectionChange([node.id]);return;
    }
  }
  function stageMove(){
    const p=pointer();if(!p||!drawStart)return;
    if(["rect","ellipse","line","arrow"].includes(tool)){setDraft(makeShape(tool,drawStart,p,paint));return;}
    if(tool==="brush")setBrushPoints(points=>points.concat([p.x,p.y]));
  }
  function stageUp(){
    if(draft){const next=addNode(scene,draft);onCommit(next,"Agregar "+draft.type);onSelectionChange([draft.id]);}
    if(tool==="brush"&&brushPoints.length>=4){
      const node:VisualNode={id:uid("brush"),type:"polyline",points:Array.from({length:brushPoints.length/2},(_,i)=>[brushPoints[i*2]!,brushPoints[i*2+1]!] as [number,number]),paint:{stroke:paint.stroke,strokeWidth:paint.brushSize,opacity:paint.opacity,lineCap:"round",lineJoin:"round"},metadata:{kind:"freehand"}};
      onCommit(addNode(scene,node),"Trazo libre");onSelectionChange([node.id]);
    }
    setDraft(null);setDrawStart(null);setBrushPoints([]);
  }

  const allNodes=useMemo(()=>sorted(scene.nodes),[scene]);
  return <Stage
    ref={stageRef}
    width={scene.width*zoom}
    height={scene.height*zoom}
    scaleX={zoom} scaleY={zoom}
    draggable={panning}
    onPointerDown={stageDown}
    onPointerMove={stageMove}
    onPointerUp={stageUp}
    onPointerCancel={stageUp}
  >
    <Layer>
      <Rect x={0} y={0} width={scene.width} height={scene.height} fill={scene.background||"#ffffff"} listening={false}/>
      {showGrid&&<>
        {Array.from({length:Math.floor(scene.width/40)+1},(_,i)=><Line key={"gv"+i} points={[i*40,0,i*40,scene.height]} stroke="#e2e8f0" strokeWidth={1} opacity={.55} listening={false}/>)}
        {Array.from({length:Math.floor(scene.height/40)+1},(_,i)=><Line key={"gh"+i} points={[0,i*40,scene.width,i*40]} stroke="#e2e8f0" strokeWidth={1} opacity={.55} listening={false}/>)}
      </>}
      {allNodes.map(node=><SceneNode
        key={node.id} node={node}
        selected={selectedIds.includes(node.id)}
        selectable={tool==="select"||tool==="eraser"||tool==="eyedropper"}
        onSelect={selectNode}
        onTransformCommit={commitTransform}
      />)}
      {draft&&<SceneNode node={draft} selected={false} selectable={false} onSelect={()=>{}} onTransformCommit={()=>{}}/>}
      {brushPoints.length>=4&&<Line points={brushPoints} stroke={paint.stroke} strokeWidth={paint.brushSize} opacity={paint.opacity} lineCap="round" lineJoin="round" listening={false}/>}
      <Transformer
        ref={transformerRef}
        rotateEnabled
        flipEnabled
        keepRatio={false}
        boundBoxFunc={(oldBox,newBox)=>Math.abs(newBox.width)<5||Math.abs(newBox.height)<5?oldBox:newBox}
      />
    </Layer>
  </Stage>;
}
