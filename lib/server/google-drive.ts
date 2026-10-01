import {requireLearningEnv} from "./learning-env";

export const DRIVE_SCOPES=[
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file"
];

export interface DriveAbout{
  user?:{displayName?:string;emailAddress?:string;photoLink?:string};
  storageQuota?:{limit?:string;usage?:string;usageInDrive?:string;usageInDriveTrash?:string};
}

function oauth(){
  const env=requireLearningEnv();
  return {
    clientId:env.googleClientId,
    clientSecret:env.googleClientSecret,
    redirectUri:env.googleRedirectUri
  };
}

export function buildDriveAuthorizationUrl(state:string){
  const cfg=oauth();
  const params=new URLSearchParams({
    client_id:cfg.clientId,
    redirect_uri:cfg.redirectUri,
    response_type:"code",
    scope:DRIVE_SCOPES.join(" "),
    access_type:"offline",
    prompt:"consent",
    include_granted_scopes:"true",
    state
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?"+params.toString();
}

async function tokenRequest(params:URLSearchParams){
  const res=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:params,
    cache:"no-store"
  });
  const payload=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error("Google OAuth "+res.status+": "+JSON.stringify(payload).slice(0,800));
  return payload as {
    access_token:string;
    expires_in?:number;
    refresh_token?:string;
    scope?:string;
    token_type?:string;
    id_token?:string;
  };
}

export async function exchangeDriveCode(code:string){
  const cfg=oauth();
  return tokenRequest(new URLSearchParams({
    code,
    client_id:cfg.clientId,
    client_secret:cfg.clientSecret,
    redirect_uri:cfg.redirectUri,
    grant_type:"authorization_code"
  }));
}

export async function refreshDriveAccessToken(refreshToken:string){
  const cfg=oauth();
  return tokenRequest(new URLSearchParams({
    refresh_token:refreshToken,
    client_id:cfg.clientId,
    client_secret:cfg.clientSecret,
    grant_type:"refresh_token"
  }));
}

async function driveJson<T=any>(accessToken:string,url:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set("Authorization","Bearer "+accessToken);
  if(init.body&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");
  const res=await fetch(url,{...init,headers,cache:"no-store"});
  const text=await res.text();
  if(!res.ok)throw new Error("Google Drive "+res.status+": "+text.slice(0,1000));
  return text?JSON.parse(text):{} as T;
}

export async function getDriveAbout(accessToken:string):Promise<DriveAbout>{
  return driveJson(accessToken,"https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota");
}

function escapeQuery(value:string){
  return value.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
}

export async function findOrCreateDriveFolder(accessToken:string,name:string,parentId?:string){
  const q=[
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    "name='"+escapeQuery(name)+"'",
    parentId?"'"+escapeQuery(parentId)+"' in parents":null
  ].filter(Boolean).join(" and ");
  const params=new URLSearchParams({q,fields:"files(id,name,parents)",pageSize:"10"});
  const found=await driveJson<{files:Array<{id:string;name:string;parents?:string[]}>}>(
    accessToken,
    "https://www.googleapis.com/drive/v3/files?"+params.toString()
  );
  if(found.files?.[0])return found.files[0];
  return driveJson<{id:string;name:string;parents?:string[]}>(
    accessToken,
    "https://www.googleapis.com/drive/v3/files?fields=id,name,parents",
    {
      method:"POST",
      body:JSON.stringify({
        name,
        mimeType:"application/vnd.google-apps.folder",
        ...(parentId?{parents:[parentId]}:{})
      })
    }
  );
}

export const LEARNING_FOLDERS=[
  "events","runs","scenes","diffs","exports","failures","datasets",
  "experiments","candidates","regression","golden-tests","releases","backups"
] as const;

export async function ensureLearningDriveTree(accessToken:string){
  const root=await findOrCreateDriveFolder(accessToken,"Visual Learning Cloud");
  const folderMap:Record<string,string>={root:root.id};
  for(const name of LEARNING_FOLDERS){
    const folder=await findOrCreateDriveFolder(accessToken,name,root.id);
    folderMap[name]=folder.id;
  }
  return {rootFolderId:root.id,folderMap};
}

export async function uploadDriveFile(input:{
  accessToken:string;
  name:string;
  parentId:string;
  bytes:Uint8Array;
  mimeType:string;
  appProperties?:Record<string,string>;
}){
  const metadata={
    name:input.name,
    parents:[input.parentId],
    appProperties:input.appProperties||{}
  };
  const form=new FormData();
  form.append("metadata",new Blob([JSON.stringify(metadata)],{type:"application/json"}));
  const copy=new Uint8Array(input.bytes.byteLength);
  copy.set(input.bytes);
  form.append("file",new Blob([copy.buffer],{type:input.mimeType}),input.name);
  const res=await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,webViewLink",
    {
      method:"POST",
      headers:{Authorization:"Bearer "+input.accessToken},
      body:form,
      cache:"no-store"
    }
  );
  const text=await res.text();
  if(!res.ok)throw new Error("Google Drive upload "+res.status+": "+text.slice(0,1000));
  return JSON.parse(text) as {id:string;name:string;size?:string;createdTime?:string;webViewLink?:string};
}
