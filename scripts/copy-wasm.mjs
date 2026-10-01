import { copyFile, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const roots=[
  path.join(process.cwd(),"node_modules","canvaskit-wasm","bin"),
  path.join(process.cwd(),"node_modules","@innova-space","visual-engine","node_modules","canvaskit-wasm","bin")
];
const destinationDir=path.join(process.cwd(),"public","wasm");
await mkdir(destinationDir,{recursive:true});

async function find(file){
  for(const root of roots){
    const candidate=path.join(root,file);
    try{await access(candidate,constants.R_OK);return candidate;}catch{}
  }
  return null;
}

for(const file of ["canvaskit.js","canvaskit.wasm"]){
  const source=await find(file);
  if(!source){
    console.warn("[visual-studio] "+file+" not found; Skia probe unavailable.");
    continue;
  }
  await copyFile(source,path.join(destinationDir,file));
  console.log("[visual-studio] self-hosted "+file);
}
