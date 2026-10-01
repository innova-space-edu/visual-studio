import {NextResponse} from "next/server";
import {currentLearningAdmin} from "@/lib/server/learning-auth";
import {getDriveAccount,getLearningCloudSummary} from "@/lib/server/learning-db";
import {learningEnv} from "@/lib/server/learning-env";

export const runtime="nodejs";

function maskEmail(value:string|null){
  if(!value)return null;
  const [name,domain]=value.split("@");
  if(!domain)return "***";
  return (name?.slice(0,2)||"")+"***@"+domain;
}

export async function GET(){
  try{
    const env=learningEnv();
    const [account,summary,session]=await Promise.all([
      env.supabaseUrl&&env.supabaseServiceKey?getDriveAccount():Promise.resolve(null),
      env.supabaseUrl&&env.supabaseServiceKey?getLearningCloudSummary():Promise.resolve({batches:0,runs:0,jobs:0}),
      currentLearningAdmin()
    ]);
    const isAdmin=!!session&&!!account?.account_email&&session.email===account.account_email.toLowerCase();
    return NextResponse.json({
      configured:{
        supabase:!!env.supabaseUrl&&!!env.supabaseServiceKey,
        googleOAuth:!!env.googleClientId&&!!env.googleClientSecret&&!!env.googleRedirectUri,
        dedicatedEncryptionKey:env.tokenEncryptionUsesDedicatedKey,
        adminAllowlist:env.adminEmails.length>0
      },
      drive:{
        connected:account?.status==="connected",
        status:account?.status||"disconnected",
        email:isAdmin?account?.account_email||null:maskEmail(account?.account_email||null),
        accountName:isAdmin?account?.account_name||null:null,
        rootFolderId:isAdmin?account?.root_folder_id||null:null,
        folderCount:isAdmin?Object.keys(account?.folder_map||{}).length:null,
        lastSyncAt:account?.last_sync_at||null,
        lastError:isAdmin?account?.last_error||null:null,
        storageQuota:isAdmin?(account?.metadata as any)?.storageQuota||null:null
      },
      summary,
      admin:isAdmin
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return NextResponse.json({error:String(error)},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
