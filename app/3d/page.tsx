import Link from "next/link";
import ThreeLab from "@/components/ThreeLab";

export default function ThreePage(){
  return <main className="platformPage">
    <header className="platformHeader">
      <div><span className="eyebrow">VISUAL STUDIO</span><h1>Visual3D Laboratory</h1><p>Three.js WebGPU con fallback local a WebGL2.</p></div>
      <div className="topActions"><Link className="navLink" href="/">Studio</Link><Link className="navLink" href="/editor">Editor</Link></div>
    </header>
    <ThreeLab/>
  </main>;
}
