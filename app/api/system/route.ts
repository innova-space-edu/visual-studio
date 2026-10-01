import { NextResponse } from "next/server";
import { listCapabilities } from "@innova-space/visual-engine";
import { listPacks } from "@innova-space/visual-assets";

export const runtime="nodejs";

export async function GET(){
  const capabilities=listCapabilities();
  return NextResponse.json({
    service:"visual-studio",
    contract:"visual-scene/1.0",
    localFirst:true,
    aiRequired:false,
    capabilities,
    assetPacks:listPacks()
  });
}
