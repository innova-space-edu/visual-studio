import { NextResponse } from "next/server";
import { listCapabilities, visualEngine } from "@innova-space/visual-engine";
import { ENGINE_CAPABILITIES } from "@innova-space/visual-design/engine";
import { listPacks } from "@innova-space/visual-assets";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const capabilities=listCapabilities();
  const packs=listPacks();
  return NextResponse.json({
    ok:true,
    service:"visual-studio",
    engineVersion:visualEngine.version,
    sceneContract:ENGINE_CAPABILITIES.contract,
    localFirst:true,
    aiRequired:false,
    externalCalls:0,
    environment:process.env.VERCEL_ENV||process.env.NODE_ENV||"unknown",
    commit:process.env.VERCEL_GIT_COMMIT_SHA||null,
    deployment:process.env.VERCEL_URL||null,
    renderTargets:["svg","png","webp","avif","pdf","canvaskit-skia","three-webgpu"],
    math:"mathjax-4",
    capabilities:{
      total:capabilities.length,
      stable:capabilities.filter(item=>item.status==="stable").length,
      beta:capabilities.filter(item=>item.status==="beta").length,
      experimental:capabilities.filter(item=>item.status==="experimental").length,
      offline:capabilities.filter(item=>item.offline).length
    },
    assetPacks:packs.map(pack=>({id:pack.id,version:pack.version})),
    timestamp:new Date().toISOString()
  },{
    status:200,
    headers:{
      "Cache-Control":"no-store",
      "X-Visual-Service":"visual-studio"
    }
  });
}
