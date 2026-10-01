import { NextRequest } from "next/server";
import {
  analyzeQuality,
  flattenNodes,
  type ImageNode,
  type VisualScene
} from "@innova-space/visual-engine";
import { hydrateMath, nodeVisualEngine } from "@innova-space/visual-engine/node";

export const runtime="nodejs";
export const maxDuration=30;

function cors(origin:string|null){
  const configured=(process.env.VISUAL_ALLOWED_ORIGINS||"").split(",").map(function(x){return x.trim();}).filter(Boolean);
  const allowed=configured.length?configured:["https://studio.visual.innova-space-edu.cl"];
  const value=origin&&allowed.includes(origin)?origin:allowed[0];
  return {
    "Access-Control-Allow-Origin":value,
    "Access-Control-Allow-Methods":"POST,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type",
    "Vary":"Origin"
  };
}

function validateLocalOnly(scene:VisualScene){
  if(scene.width>8192||scene.height>8192)throw new Error("Canvas exceeds 8192 px limit.");
  const nodes=flattenNodes(scene.nodes);
  if(nodes.length>10000)throw new Error("Scene exceeds 10,000 node limit.");
  for(const node of nodes){
    if(node.type!=="image")continue;
    const href=(node as ImageNode).href||"";
    const local=href.startsWith("data:")||href.startsWith("/")||href.startsWith("blob:");
    if(!local)throw new Error("Remote image references are disabled in local-first render mode.");
  }
}

export async function OPTIONS(req:NextRequest){
  return new Response(null,{status:204,headers:cors(req.headers.get("origin"))});
}

export async function POST(req:NextRequest){
  const origin=req.headers.get("origin");
  try{
    const body=await req.json();
    let scene=body.scene as VisualScene;
    if(!scene||scene.version!=="1.0"){
      return Response.json({error:"VisualScene 1.0 is required"},{status:400,headers:cors(origin)});
    }
    validateLocalOnly(scene);
    if(body.math!==false){
      try{scene=await hydrateMath(scene);}catch{}
    }
    const quality=analyzeQuality(scene);
    if(body.format==="png"){
      const rendered=await nodeVisualEngine.renderPng(scene,{pixelRatio:Math.min(4,Math.max(1,Number(body.pixelRatio)||1))});
      if(rendered.format!=="png"){
        return Response.json({error:"PNG renderer unavailable",diagnostics:rendered.diagnostics},{status:503,headers:cors(origin)});
      }
      const bytes=rendered.data as Uint8Array;
      const copy=new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Response(copy.buffer,{
        status:200,
        headers:Object.assign({"Content-Type":"image/png","X-Visual-Quality":String(quality.score)},cors(origin))
      });
    }
    const rendered=nodeVisualEngine.renderSvg(scene,{pretty:false});
    return new Response(rendered.data as string,{
      status:200,
      headers:Object.assign({"Content-Type":"image/svg+xml; charset=utf-8","X-Visual-Quality":String(quality.score)},cors(origin))
    });
  }catch(error){
    return Response.json({error:String(error)},{status:400,headers:cors(origin)});
  }
}
