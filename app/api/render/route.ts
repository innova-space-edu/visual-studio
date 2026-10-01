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
    let mathStatus="disabled";
    let mathError="";
    if(body.math!==false){
      try{
        scene=await hydrateMath(scene);
        mathStatus="ok";
      }catch(error){
        mathStatus="fallback";
        mathError=String(error);
        if(body.strictMath===true){
          return Response.json({error:"MathJax hydration failed",detail:mathError},{
            status:500,
            headers:Object.assign({"X-Visual-Math":"error"},cors(origin))
          });
        }
      }
    }
    const quality=analyzeQuality(scene);
    const responseHeaders=Object.assign({
      "X-Visual-Quality":String(quality.score),
      "X-Visual-Math":mathStatus
    },cors(origin));
    if(mathError)responseHeaders["X-Visual-Math-Fallback"]="1";
    const format=String(body.format||"svg").toLowerCase();
    const pixelRatio=Math.min(4,Math.max(1,Number(body.pixelRatio)||1));

    if(format==="png"){
      const rendered=await nodeVisualEngine.renderPng(scene,{pixelRatio});
      const bytes=rendered.data as Uint8Array;
      const copy=new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Response(copy.buffer,{
        status:200,
        headers:Object.assign({"Content-Type":"image/png"},responseHeaders)
      });
    }

    if(format==="webp"){
      const rendered=await nodeVisualEngine.renderWebp(scene,{quality:Math.min(100,Math.max(1,Number(body.quality)||90))});
      const bytes=rendered.data as Uint8Array;
      const copy=new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Response(copy.buffer,{
        status:200,
        headers:Object.assign({"Content-Type":"image/webp"},responseHeaders)
      });
    }

    if(format==="avif"){
      const rendered=await nodeVisualEngine.renderAvif(scene,{quality:Math.min(100,Math.max(1,Number(body.quality)||80))});
      const bytes=rendered.data as Uint8Array;
      const copy=new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Response(copy.buffer,{
        status:200,
        headers:Object.assign({"Content-Type":"image/avif"},responseHeaders)
      });
    }

    if(format==="pdf"){
      const rendered=await nodeVisualEngine.renderPdf(scene,{pixelRatio});
      const bytes=rendered.data as Uint8Array;
      const copy=new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Response(copy.buffer,{
        status:200,
        headers:Object.assign({"Content-Type":"application/pdf"},responseHeaders)
      });
    }

    if(format!=="svg"){
      return Response.json({error:"Unsupported format"},{status:400,headers:cors(origin)});
    }

    const rendered=nodeVisualEngine.renderSvg(scene,{pretty:false});
    return new Response(rendered.data as string,{
      status:200,
      headers:Object.assign({"Content-Type":"image/svg+xml; charset=utf-8"},responseHeaders)
    });
  }catch(error){
    return Response.json({error:String(error)},{status:400,headers:cors(origin)});
  }
}
