import Link from "next/link";
import { listCapabilities } from "@innova-space/visual-engine";
import { listPacks } from "@innova-space/visual-assets";

export const dynamic="force-dynamic";

export default function StatusPage(){
  const capabilities=listCapabilities();
  const packs=listPacks();
  const groups={
    stable:capabilities.filter(item=>item.status==="stable"),
    beta:capabilities.filter(item=>item.status==="beta"),
    experimental:capabilities.filter(item=>item.status==="experimental"),
    planned:capabilities.filter(item=>item.status==="planned")
  };
  const commit=process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)||"local";
  const env=process.env.VERCEL_ENV||process.env.NODE_ENV||"unknown";

  return <main className="platformPage">
    <header className="platformHeader">
      <div>
        <span className="eyebrow">VISUAL STUDIO · STATUS</span>
        <h1>Estado de producción</h1>
        <p>Runtime determinista, formatos de salida y capacidades cargadas.</p>
      </div>
      <div className="topActions">
        <Link className="navLink" href="/">Studio</Link>
        <Link className="navLink" href="/platform">Plataforma</Link>
      </div>
    </header>

    <section className="platformSummary">
      <article><span>Entorno</span><strong>{env}</strong></article>
      <article><span>Commit</span><strong className="smallMetric">{commit}</strong></article>
      <article><span>Capacidades</span><strong>{capabilities.length}</strong></article>
      <article><span>Asset packs</span><strong>{packs.length}</strong></article>
    </section>

    <section className="platformGrid">
      <div className="platformPanel">
        <h2>Runtime</h2>
        <div className="statusRows">
          <div><span>VisualScene</span><strong>1.0</strong></div>
          <div><span>IA requerida</span><strong>No</strong></div>
          <div><span>Offline-capable</span><strong>{capabilities.filter(item=>item.offline).length}/{capabilities.length}</strong></div>
          <div><span>Render API</span><strong>SVG · PNG · WebP · AVIF · PDF</strong></div>
          <div><span>Workers / WASM</span><strong>local-first</strong></div>
        </div>
      </div>
      <aside className="platformPanel">
        <h2>Madurez</h2>
        {Object.entries(groups).map(([name,items])=><div className="statusGroup" key={name}>
          <span className={"badge "+name}>{name}</span>
          <strong>{items.length}</strong>
        </div>)}
      </aside>
    </section>
  </main>;
}
