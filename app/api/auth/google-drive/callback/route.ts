import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
import {exchangeDriveCode,getDriveAbout,ensureLearningDriveTree,DRIVE_SCOPES} from "@/lib/server/google-drive";
import {encryptLearningSecret,signAdminSession} from "@/lib/server/learning-crypto";
import {getDriveAccount,upsertDriveAccount} from "@/lib/server/learning-db";
import {learningEnv,requireLearningEnv} from "@/lib/server/learning-env";
import {ADMIN_COOKIE} from "@/lib/server/learning-auth";

export const runtime="nodejs";
export const maxDuration=60;

function redirect(request:NextRequest,params:Record<string,string>){
  const url=new URL("/admin/storage",request.url);
  Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
  return NextResponse.redirect(url);
}

export async function GET(request:NextRequest){
  try{
    const env=requireLearningEnv();
    const error=request.nextUrl.searchParams.get("error");
    if(error)return redirect(request,{error:"google_"+error});
    const code=request.nextUrl.searchParams.get("code")||"";
    const state=request.nextUrl.searchParams.get("state")||"";
    const store=await cookies();
    const expected=store.get("visual_drive_oauth_state")?.value||"";
    store.delete("visual_drive_oauth_state");
    if(!code||!state||!expected||state!==expected)return redirect(request,{error:"invalid_oauth_state"});

    const token=await exchangeDriveCode(code);
    const about=await getDriveAbout(token.access_token);
    const email=String(about.user?.emailAddress||"").trim().toLowerCase();
    if(!email)return redirect(request,{error:"google_email_unavailable"});

    const existing=await getDriveAccount();
    if(existing?.account_email&&existing.account_email.toLowerCase()!==email){
      return redirect(request,{error:"drive_already_claimed"});
    }
    if(env.adminEmails.length&&!env.adminEmails.includes(email)){
      return redirect(request,{error:"email_not_allowed"});
    }

    const refreshToken=token.refresh_token;
    if(!refreshToken&&!existing?.refresh_token_ciphertext){
      return redirect(request,{error:"refresh_token_missing"});
    }
    const tree=await ensureLearningDriveTree(token.access_token);
    const encrypted=refreshToken?encryptLearningSecret(refreshToken):existing!.refresh_token_ciphertext;
    const now=new Date().toISOString();
    await upsertDriveAccount({
      provider:"google_drive",
      account_email:email,
      account_name:String(about.user?.displayName||""),
      refresh_token_ciphertext:encrypted,
      root_folder_id:tree.rootFolderId,
      folder_map:tree.folderMap,
      scopes:String(token.scope||DRIVE_SCOPES.join(" ")).split(/\s+/).filter(Boolean),
      status:"connected",
      connected_at:existing?.connected_at||now,
      last_error:null,
      updated_at:now,
      metadata:{
        ...(existing?.metadata||{}),
        storageQuota:about.storageQuota||null,
        tokenEncryptionUsesDedicatedKey:learningEnv().tokenEncryptionUsesDedicatedKey
      }
    });

    const response=redirect(request,{connected:"1"});
    response.cookies.set(ADMIN_COOKIE,signAdminSession(email),{
      httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*24*30
    });
    return response;
  }catch(error){
    return redirect(request,{error:encodeURIComponent(String(error).slice(0,300))});
  }
}
