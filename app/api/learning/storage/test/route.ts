import {NextResponse} from "next/server";
import {decryptLearningSecret} from "@/lib/server/learning-crypto";
import {requireLearningAdmin} from "@/lib/server/learning-auth";
import {getDriveAccount,updateDriveAccount} from "@/lib/server/learning-db";
import {getDriveAbout,refreshDriveAccessToken} from "@/lib/server/google-drive";

export const runtime="nodejs";

export async function POST(){
  try{
    const account=await getDriveAccount();
    await requireLearningAdmin(account);
    if(!account)throw new Error("Google Drive is not connected");
    const refreshToken=decryptLearningSecret(account.refresh_token_ciphertext);
    const token=await refreshDriveAccessToken(refreshToken);
    const about=await getDriveAbout(token.access_token);
    await updateDriveAccount({
      status:"connected",
      last_error:null,
      metadata:{...(account.metadata||{}),storageQuota:about.storageQuota||null,lastTestAt:new Date().toISOString()}
    });
    return NextResponse.json({
      ok:true,
      email:about.user?.emailAddress||account.account_email,
      storageQuota:about.storageQuota||null,
      rootFolderId:account.root_folder_id
    });
  }catch(error){
    try{await updateDriveAccount({status:"error",last_error:String(error).slice(0,800)});}catch{}
    return NextResponse.json({ok:false,error:String(error)},{status:500});
  }
}
