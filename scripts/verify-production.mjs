import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const required=[
  ".next",
  "public/wasm/canvaskit.js",
  "public/wasm/canvaskit.wasm",
  "vercel.json",
  "app/api/auth/google-drive/start/route.ts",
  "app/api/auth/google-drive/callback/route.ts",
  "app/api/learning/sync/route.ts",
  "app/admin/storage/page.tsx",
  "supabase/migrations/20261001224000_learning_cloud_v1.sql"
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

const mathjaxModule=await import("mathjax");
const MathJaxFactory=mathjaxModule.default||mathjaxModule;
const MathJax=await MathJaxFactory.init({
  loader:{load:["input/tex","output/svg","[tex]/mhchem"]},
  tex:{packages:{"[+]":["mhchem"]}},
  svg:{fontCache:"none"}
});
const mathNode=await MathJax.tex2svgPromise("\\frac{a}{b}+\\sqrt{x^2}",{display:true});
const mathSvg=MathJax.startup.adaptor.serializeXML(mathNode);
if(!mathSvg.includes("<svg")){
  console.error("[visual-studio] MathJax 4 SVG renderer is unavailable");
  process.exit(1);
}
const chemNode=await MathJax.tex2svgPromise("\\ce{2H2 + O2 -> 2H2O}",{display:true});
const chemSvg=MathJax.startup.adaptor.serializeXML(chemNode);
if(!chemSvg.includes("<svg")){
  console.error("[visual-studio] MathJax mhchem SVG renderer is unavailable");
  process.exit(1);
}
const katexModule=await import("katex");
await import("katex/contrib/mhchem");
const katex=katexModule.default||katexModule;
const katexHtml=katex.renderToString("\\frac{a}{b}",{displayMode:true,throwOnError:true});
if(!katexHtml.includes("katex")){
  console.error("[visual-studio] KaTeX fallback validator is unavailable");
  process.exit(1);
}

console.log("[visual-studio] production verification passed");
