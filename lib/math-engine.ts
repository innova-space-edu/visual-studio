import type { MathNode, VisualNode, VisualScene } from "@innova-space/visual-engine";

export type MathEngineName="mathjax-svg"|"katex-fallback"|"none";

export interface HydratedMathResult {
  scene:VisualScene;
  engine:MathEngineName|"mixed";
  count:number;
  fallbackCount:number;
  warnings:string[];
}

let mathjaxPromise:Promise<any>|null=null;
let katexPromise:Promise<any>|null=null;

function escapeXml(value:string){
  return String(value).replace(/[&<>"']/g,function(char){
    const map:Record<string,string>={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"};
    return map[char]||char;
  });
}

async function mathjaxInstance(){
  if(!mathjaxPromise){
    mathjaxPromise=(async function(){
      const mod:any=await import("mathjax");
      const factory=mod.default||mod;
      return factory.init({
        loader:{load:["input/tex","output/svg","[tex]/mhchem"]},
        tex:{packages:{"[+]":["mhchem"]}},
        svg:{fontCache:"none"}
      });
    })();
  }
  return mathjaxPromise;
}

async function katexInstance(){
  if(!katexPromise){
    katexPromise=(async function(){
      const mod:any=await import("katex");
      await import("katex/contrib/mhchem");
      return mod.default||mod;
    })();
  }
  return katexPromise;
}

function extractSvg(serialized:string){
  const start=serialized.indexOf("<svg");
  const end=serialized.lastIndexOf("</svg>");
  if(start<0||end<start)throw new Error("MathJax did not return SVG markup");
  return serialized.slice(start,end+6);
}

function subscriptDigits(value:string){
  const map:Record<string,string>={"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉","+":"₊","-":"₋"};
  return value.split("").map(char=>map[char]||char).join("");
}
function superscriptDigits(value:string){
  const map:Record<string,string>={"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻"};
  return value.split("").map(char=>map[char]||char).join("");
}

function readableLatex(latex:string){
  return String(latex)
    .replace(/\\ce\{([^{}]*)\}/g,"$1")
    .replace(/\\mathrm\{([^{}]*)\}/g,"$1")
    .replace(/\\text\{([^{}]*)\}/g,"$1")
    .replace(/\\rightarrow|\\to/g,"→")
    .replace(/\\leftarrow/g,"←")
    .replace(/\\leftrightarrow/g,"↔")
    .replace(/\\times/g,"×")
    .replace(/\\cdot/g,"·")
    .replace(/\\pm/g,"±")
    .replace(/\\leq/g,"≤")
    .replace(/\\geq/g,"≥")
    .replace(/_\{([0-9+\-]+)\}/g,(_,digits)=>subscriptDigits(digits))
    .replace(/_([0-9])/g,(_,digit)=>subscriptDigits(digit))
    .replace(/\^\{([0-9+\-]+)\}/g,(_,digits)=>superscriptDigits(digits))
    .replace(/\^([0-9])/g,(_,digit)=>superscriptDigits(digit))
    .replace(/\\sqrt\{([^{}]+)\}/g,"√($1)")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,"$1⁄$2")
    .replace(/[{}]/g,"")
    .replace(/\\;/g," ")
    .replace(/\\,/g," ")
    .replace(/\\([A-Za-z]+)/g,"$1")
    .replace(/\s+/g," ")
    .trim();
}

function fallbackSvg(latex:string){
  const readable=readableLatex(latex)||latex;
  const width=Math.max(180,Math.min(1200,readable.length*16+24));
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="52" viewBox="0 0 '+width+' 52" data-math-engine="katex-fallback">'+
    '<text x="4" y="35" font-family="STIX Two Math,Cambria Math,serif" font-size="28" fill="currentColor">'+escapeXml(readable)+'</text></svg>';
}

export async function renderLatexSvg(latex:string,display=true){
  try{
    const MathJax=await mathjaxInstance();
    const node=await MathJax.tex2svgPromise(String(latex),{
      display,
      em:16,
      ex:8,
      containerWidth:1600
    });
    const serialized=MathJax.startup.adaptor.serializeXML(node);
    return {svg:extractSvg(serialized),engine:"mathjax-svg" as const};
  }catch(primaryError){
    const warning="MathJax: "+String(primaryError);
    try{
      const katex=await katexInstance();
      katex.renderToString(String(latex),{
        displayMode:display,
        throwOnError:true,
        strict:"warn",
        output:"htmlAndMathml"
      });
      return {svg:fallbackSvg(latex),engine:"katex-fallback" as const,warning};
    }catch(katexError){
      throw new Error(warning+" | KaTeX: "+String(katexError));
    }
  }
}

async function hydrateNode(node:VisualNode,state:{count:number;fallbacks:number;warnings:string[]}):Promise<VisualNode>{
  if(node.type==="math"){
    const rendered=await renderLatexSvg(node.latex,true);
    state.count++;
    if(rendered.engine!=="mathjax-svg")state.fallbacks++;
    if(rendered.warning)state.warnings.push(node.id+": "+rendered.warning);
    return {
      ...node,
      svg:rendered.svg,
      metadata:{...(node.metadata||{}),mathEngine:rendered.engine}
    } as MathNode;
  }
  if(node.type==="group"){
    const children:VisualNode[]=[];
    for(const child of node.children)children.push(await hydrateNode(child,state));
    return {...node,children};
  }
  return node;
}

export async function hydrateMathScene(scene:VisualScene):Promise<HydratedMathResult>{
  const state={count:0,fallbacks:0,warnings:[] as string[]};
  const nodes:VisualNode[]=[];
  for(const node of scene.nodes)nodes.push(await hydrateNode(node,state));
  const engine:HydratedMathResult["engine"]=
    state.count===0?"none":
    state.fallbacks===0?"mathjax-svg":
    state.fallbacks===state.count?"katex-fallback":"mixed";
  return {
    scene:{...scene,nodes,metadata:{...(scene.metadata||{}),mathEngine:engine}},
    engine,
    count:state.count,
    fallbackCount:state.fallbacks,
    warnings:state.warnings
  };
}
