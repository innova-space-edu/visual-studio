import {randomBytes} from "node:crypto";
import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {buildDriveAuthorizationUrl} from "@/lib/server/google-drive";
import {requireLearningEnv} from "@/lib/server/learning-env";

export const runtime="nodejs";

export async function GET(){
  try{
    requireLearningEnv();
    const state=randomBytes(24).toString("base64url");
    const store=await cookies();
    store.set("visual_drive_oauth_state",state,{
      httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:600
    });
    return NextResponse.redirect(buildDriveAuthorizationUrl(state));
  }catch(error){
    return NextResponse.json({error:String(error)},{status:500});
  }
}
