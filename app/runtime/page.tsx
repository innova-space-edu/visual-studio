import Link from "next/link";
import RuntimeLab from "@/components/RuntimeLab";

export default function RuntimePage(){
  return <main className="platformPage">
    <header className="platformHeader">
      <div><span className="eyebrow">VISUAL STUDIO</span><h1>Runtime Laboratory</h1><p>Prueba Web Workers, OffscreenCanvas y timeline determinista en el navegador.</p></div>
      <div className="topActions"><Link className="navLink" href="/">Studio</Link><Link className="navLink" href="/editor">Editor</Link></div>
    </header>
    <RuntimeLab/>
  </main>;
}
