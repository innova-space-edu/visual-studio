import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual,createHmac} from "node:crypto";
import {requireLearningEnv} from "./learning-env";

function key(){
  const source=requireLearningEnv().tokenEncryptionKey;
  return createHash("sha256").update("visual-learning-token-v1\0"+source).digest();
}

export function encryptLearningSecret(plain:string){
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key(),iv);
  const encrypted=Buffer.concat([cipher.update(plain,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return ["v1",iv.toString("base64url"),tag.toString("base64url"),encrypted.toString("base64url")].join(".");
}

export function decryptLearningSecret(value:string){
  const [version,ivRaw,tagRaw,dataRaw]=String(value).split(".");
  if(version!=="v1"||!ivRaw||!tagRaw||!dataRaw)throw new Error("Unsupported encrypted token format");
  const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(ivRaw,"base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw,"base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw,"base64url")),decipher.final()]).toString("utf8");
}

function sessionKey(){
  return createHash("sha256").update("visual-learning-admin-session-v1\0"+requireLearningEnv().googleClientSecret).digest();
}

export function signAdminSession(email:string){
  const normalized=email.trim().toLowerCase();
  const issued=Math.floor(Date.now()/1000);
  const payload=Buffer.from(JSON.stringify({email:normalized,iat:issued}),"utf8").toString("base64url");
  const sig=createHmac("sha256",sessionKey()).update(payload).digest("base64url");
  return payload+"."+sig;
}

export function verifyAdminSession(value:string|undefined|null){
  if(!value)return null;
  const [payload,sig]=String(value).split(".");
  if(!payload||!sig)return null;
  const expected=createHmac("sha256",sessionKey()).update(payload).digest();
  let actual:Buffer;
  try{actual=Buffer.from(sig,"base64url");}catch{return null;}
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  try{
    const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    if(!data?.email||!data?.iat)return null;
    if(Math.floor(Date.now()/1000)-Number(data.iat)>60*60*24*30)return null;
    return {email:String(data.email),iat:Number(data.iat)};
  }catch{return null;}
}
