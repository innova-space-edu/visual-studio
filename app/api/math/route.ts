import { NextRequest } from "next/server";
import { colorizeMathSvg, renderLatexSvg } from "@/lib/math-engine";

export const runtime="nodejs";
export const maxDuration=15;

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const latex=String(body?.latex||"").trim();
    if(!latex)return Response.json({error:"latex is required"},{status:400});
    if(latex.length>5000)return Response.json({error:"latex exceeds 5000 characters"},{status:400});
    const color=String(body?.color||"#0f172a");
    const rendered=await renderLatexSvg(latex,body?.display!==false);
    return new Response(colorizeMathSvg(rendered.svg,color),{
      status:200,
      headers:{
        "Content-Type":"image/svg+xml; charset=utf-8",
        "Cache-Control":"no-store",
        "X-Visual-Math-Engine":rendered.engine
      }
    });
  }catch(error){
    return Response.json({error:String(error)},{status:400});
  }
}
