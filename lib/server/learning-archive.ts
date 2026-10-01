import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {decryptLearningSecret} from "./learning-crypto";
import {findLearningObject,getDriveAccount,insertLearningObject,touchLearningObject} from "./learning-db";
import {refreshDriveAccessToken,uploadDriveFile} from "./google-drive";

type ArchiveKind="candidate"|"experiment"|"regression"|"release"|"dataset"|"backup"|"other";

export async function archiveLearningJson(input:{
  kind:ArchiveKind;
  folder:string;
  prefix:string;
  payload:unknown;
  metadata?:Record<string,unknown>;
}){
  const serialized=JSON.stringify(input.payload);
  const sha256=createHash("sha256").update(serialized).digest("hex");
  const existing=await findLearningObject(sha256);
  if(existing){
    await touchLearningObject(sha256,Number(existing.reference_count||1)+1);
    return {sha256,fileId:existing.drive_file_id,duplicate:true,path:existing.drive_path};
  }
  const account=await getDriveAccount();
  if(!account)throw new Error("Google Drive is not connected");
  const folderId=account.folder_map?.[input.folder];
  if(!folderId)throw new Error("Drive folder is missing: "+input.folder);
  const token=await refreshDriveAccessToken(decryptLearningSecret(account.refresh_token_ciphertext));
  const gz=gzipSync(Buffer.from(serialized,"utf8"),{level:9});
  const name=input.prefix+"-"+sha256.slice(0,16)+".json.gz";
  const uploaded=await uploadDriveFile({
    accessToken:token.access_token,name,parentId:folderId,bytes:new Uint8Array(gz),mimeType:"application/gzip",
    appProperties:{sha256,kind:input.kind,privacy:"structured-v1"}
  });
  await insertLearningObject({
    sha256,kind:input.kind,provider:"google_drive",drive_file_id:uploaded.id,drive_folder_id:folderId,
    drive_path:input.folder+"/"+name,mime_type:"application/gzip",size_bytes:gz.byteLength,reference_count:1,
    metadata:{...(input.metadata||{}),privacy:"structured-v1"}
  });
  return {sha256,fileId:uploaded.id,duplicate:false,path:input.folder+"/"+name};
}
