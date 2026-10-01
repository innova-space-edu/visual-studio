import { NextResponse } from "next/server";
import { visualEngine } from "@innova-space/visual-engine";
import { ENGINE_CAPABILITIES } from "@innova-space/visual-design/engine";
import { listPacks } from "@innova-space/visual-assets";

export const runtime="nodejs";

export async function GET(){
  return NextResponse.json({
    ok:true,
    service:"visual-studio",
    engineVersion:visualEngine.version,
    sceneContract:ENGINE_CAPABILITIES.contract,
    localFirst:true,
    externalCalls:0,
    assetPacks:listPacks(),
    renderTargets:["svg","png","canvaskit-skia","three-webgpu-experimental"],
    math:"mathjax-4"
  });
}
