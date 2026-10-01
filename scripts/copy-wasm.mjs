import { copyFile, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const candidates=[
  path.join(process.cwd(),"node_modules","canvaskit-wasm","bin","canvaskit.wasm"),
  path.join(process.cwd(),"node_modules","@innova-space","visual-engine","node_modules","canvaskit-wasm","bin","canvaskit.wasm")
];
const destinationDir=path.join(process.cwd(),"public","wasm");
const destination=path.join(destinationDir,"canvaskit.wasm");
await mkdir(destinationDir,{recursive:true});
let source=null;
for(const candidate of candidates){
  try{await access(candidate,constants.R_OK);source=candidate;break;}catch{}
}
if(!source){
  console.warn("[visual-studio] CanvasKit WASM not found; Skia probe unavailable.");
  process.exit(0);
}
await copyFile(source,destination);
console.log("[visual-studio] CanvasKit WASM self-hosted.");
