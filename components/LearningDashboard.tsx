"use client";

import { useEffect, useMemo, useState } from "react";
import { VisualLearningEngine, type LearningSnapshot } from "@innova-space/visual-engine";
import { loadLearningSnapshot } from "@/lib/persistence";

export default function LearningDashboard(){
  const [snapshot,setSnapshot]=useState<LearningSnapshot|null>(null);
  useEffect(()=>{loadLearningSnapshot<LearningSnapshot>().then(setSnapshot);},[]);
  const rows=useMemo(()=>{
    if(!snapshot)return [];
    const engine=new VisualLearningEngine();
    engine.restore(snapshot);
    return engine.rank(Object.keys(snapshot.stats));
  },[snapshot]);

  return <section className="platformPanel">
    <h2>Learning Engine</h2>
    <p className="muted">Preferencias aprendidas desde feedback humano. No entrena un modelo y no hace llamadas externas.</p>
    {!snapshot&&<p className="muted">Todavía no hay feedback almacenado en este navegador.</p>}
    {snapshot&&<>
      <div className="platformSummary compactSummary">
        <article><span>Muestras</span><strong>{snapshot.total}</strong></article>
        <article><span>Candidatos</span><strong>{rows.length}</strong></article>
      </div>
      <div className="learningTable">
        {rows.map(row=><div className="learningRow" key={row.key}>
          <div><strong>{row.key}</strong><small>{row.accepted} aceptadas · {row.rejected} rechazadas</small></div>
          <span>{row.meanQuality.toFixed(1)}</span>
          <span>{row.score.toFixed(3)}</span>
        </div>)}
      </div>
    </>}
  </section>;
}
