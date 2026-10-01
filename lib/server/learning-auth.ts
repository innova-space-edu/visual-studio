import {cookies} from "next/headers";
import {verifyAdminSession} from "./learning-crypto";
import type {LearningStorageAccount} from "./learning-db";

export const ADMIN_COOKIE="visual_learning_admin";

export async function currentLearningAdmin(){
  const store=await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
}

export async function requireLearningAdmin(account:LearningStorageAccount|null){
  const session=await currentLearningAdmin();
  if(!session||!account?.account_email||session.email!==account.account_email.toLowerCase()){
    throw new Error("Learning admin session required");
  }
  return session;
}

export function sameOriginOrIngestToken(request:Request){
  const url=new URL(request.url);
  const origin=request.headers.get("origin");
  if(origin){
    try{if(new URL(origin).origin===url.origin)return true;}catch{}
  }
  const expected=String(process.env.LEARNING_INGEST_TOKEN||"").trim();
  const supplied=request.headers.get("x-learning-ingest-token")||"";
  return !!expected&&supplied===expected;
}
