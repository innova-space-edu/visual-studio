import Link from "next/link";
import LearningDashboard from "@/components/LearningDashboard";

export default function LearningPage(){
  return <main className="platformPage">
    <header className="platformHeader">
      <div><span className="eyebrow">VISUAL STUDIO</span><h1>Learning Engine</h1><p>Evaluación estadística de layouts, skills y renderers a partir del feedback local.</p></div>
      <div className="topActions"><Link className="navLink" href="/">Studio</Link><Link className="navLink" href="/editor">Editor</Link></div>
    </header>
    <div style={{marginTop:22}}><LearningDashboard/></div>
  </main>;
}
