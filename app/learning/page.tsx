import Link from "next/link";
import LearningDashboard from "@/components/LearningDashboard";

export default function LearningPage(){
  return <main className="platformPage">
    <header className="platformHeader">
      <div><span className="eyebrow">VISUAL STUDIO</span><h1>Learning Intelligence</h1><p>Recorder, optimización, experimentos, regresiones y candidatos administrados antes de cualquier cambio de producción.</p></div>
      <div className="topActions"><Link className="navLink" href="/admin/storage">Storage</Link><Link className="navLink" href="/">Studio</Link><Link className="navLink" href="/editor">Editor</Link></div>
    </header>
    <div style={{marginTop:22}}><LearningDashboard/></div>
  </main>;
}
