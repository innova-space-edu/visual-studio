import Link from "next/link";
import { listCapabilities } from "@innova-space/visual-engine";
import { listPacks } from "@innova-space/visual-assets";

export default function PlatformPage(){
  const capabilities=listCapabilities();
  const packs=listPacks();
  return <main className="platformPage">
    <header className="platformHeader">
      <div>
        <span className="eyebrow">VISUAL PLATFORM</span>
        <h1>Motor, skills, assets y laboratorio</h1>
        <p>Estado técnico del stack determinista. Esta vista no usa proveedores de IA.</p>
      </div>
      <Link className="navLink" href="/">Volver al Studio</Link>
    </header>

    <section className="platformSummary">
      <article><span>Capacidades</span><strong>{capabilities.length}</strong></article>
      <article><span>Offline</span><strong>{capabilities.filter(x=>x.offline).length}</strong></article>
      <article><span>Deterministas</span><strong>{capabilities.filter(x=>x.deterministic).length}</strong></article>
      <article><span>Asset packs</span><strong>{packs.length}</strong></article>
    </section>

    <section className="platformGrid">
      <div className="platformPanel">
        <h2>Capability matrix</h2>
        <div className="capabilityTable">
          {capabilities.map(function(cap){
            return <div className="capabilityRow" key={cap.id}>
              <div><strong>{cap.id}</strong><small>{cap.description}</small></div>
              <span>{cap.category}</span>
              <span className={"badge "+cap.status}>{cap.status}</span>
              <span>{cap.runtime.join(" · ")}</span>
            </div>
          })}
        </div>
      </div>
      <aside className="platformPanel">
        <h2>Asset packs</h2>
        {packs.map(function(pack:any){
          return <div className="packCard" key={pack.id}>
            <strong>{pack.id}</strong>
            <small>{pack.version}</small>
            <p>{pack.description}</p>
          </div>
        })}
        <h2>Principio de ejecución</h2>
        <p className="muted">VisualBrief / DSL → VisualScene → quality gate → SVG/Skia/WebGPU → export. IA opcional por encima del pipeline, nunca requerida para renderizar.</p>
      </aside>
    </section>
  </main>;
}
