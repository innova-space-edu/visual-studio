import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const required=[
  ".next",
  "public/wasm/canvaskit.js",
  "public/wasm/canvaskit.wasm",
  "vercel.json"
];

const missing=required.filter(item=>!fs.existsSync(path.join(root,item)));
if(missing.length){
  console.error("[visual-studio] missing production artifacts:",missing.join(", "));
  process.exit(1);
}

const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const deps=pkg.dependencies||{};
for(const name of ["@innova-space/visual-engine","@innova-space/visual-assets","@innova-space/visual-design"]){
  const value=String(deps[name]||"");
  if(!/#[0-9a-f]{40}$/i.test(value)){
    console.error("[visual-studio] dependency is not pinned to a commit:",name,value);
    process.exit(1);
  }
}

const nextConfig=fs.readFileSync(path.join(root,"next.config.mjs"),"utf8");
if(!nextConfig.includes("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'")){
  console.error("[visual-studio] CSP must allow Next.js inline hydration bootstrap scripts");
  process.exit(1);
}
if(!nextConfig.includes("worker-src 'self' blob:")){
  console.error("[visual-studio] CSP must allow local module workers");
  process.exit(1);
}

const vercel=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
const deployment=vercel?.git?.deploymentEnabled;
if(!deployment||deployment.main!==true||deployment["*"]!==false){
  console.error("[visual-studio] Vercel deployment policy must allow only main");
  process.exit(1);
}

const { latexToSvg }=await import("@innova-space/visual-engine/node");
const mathSvg=await latexToSvg("x^2+y^2=r^2");
if(!mathSvg.includes("<svg")){
  console.error("[visual-studio] MathJax SVG hydration is unavailable");
  process.exit(1);
}

console.log("[visual-studio] production verification passed");
