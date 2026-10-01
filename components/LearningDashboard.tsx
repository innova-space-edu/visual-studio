"use client";

import {useEffect,useMemo,useState} from "react";
import {
  VisualLearningEngine,VisualLearningEngineV2,
  type LearningSnapshot,type LearningSnapshotV2
} from "@innova-space/visual-engine";
import {loadLearningSnapshot} from "@/lib/persistence";

type Tab="overview"|"engine"|"skills"|"assets"|"legacy";

export default function LearningDashboard(){
  const [tab,setTab]=useState<Tab>("overview");
  const [legacy,setLegacy]=useState<LearningSnapshot|null>(null);
  const [engineV2,setEngineV2]=useState<LearningSnapshotV2|null>(null);
  const [skills,setSkills]=useState<any>(null);
  const [assets,setAssets]=useState<any>(null);

  useEffect(()=>{
    Promise.all([
      loadLearningSnapshot<LearningSnapshot>("default"),
      loadLearningSnapshot<LearningSnapshotV2>("engine-v2"),
      loadLearningSnapshot<any>("skills-v1"),
      loadLearningSnapshot<any>("assets-v1")
    ]).then(([a,b,c,d])=>{setLegacy(a);setEngineV2(b);setSkills(c);setAssets(d);});
  },[]);

  const legacyRows=useMemo(()=>{
    if(!legacy)return [];
    const engine=new VisualLearningEngine();engine.restore(legacy);
    return engine.rank(Object.keys(legacy.stats));
  },[legacy]);

  const v2Parameters=useMemo(()=>Object.values(engineV2?.parameters||{}).sort((a,b)=>b.samples-a.samples),[engineV2]);
  const v2Preferences=useMemo(()=>Object.values(engineV2?.preferences||{}).sort((a,b)=>b.score-a.score),[engineV2]);
  const skillRows=useMemo(()=>Object.values(skills?.stats||{}).sort((a:any,b:any)=>b.score-a.score) as any[],[skills]);
  const assetRows=useMemo(()=>Object.values(assets?.stats||{}).sort((a:any,b:any)=>b.score-a.score) as any[],[assets]);

  const totalSignals=(engineV2?.events||0)+(skills?skillRows.reduce((sum,row)=>sum+Number(row.samples||0),0):0)+(assets?assetRows.reduce((sum,row)=>sum+Number(row.samples||0),0):0);

  return <section className="learningSuite">
    <div className="learningHero">
      <div><span className="eyebrow">VISUAL LEARNING</span><h2>Aprendizaje continuo de la plataforma</h2><p className="muted">Las ediciones, aceptación, exportaciones, skills y assets actualizan preferencias locales sin entrenar un modelo neuronal.</p></div>
      <div className="learningHeroMetric"><span>Señales</span><strong>{totalSignals}</strong></div>
    </div>

    <div className="learningTabs">
      {(["overview","engine","skills","assets","legacy"] as Tab[]).map(value=><button key={value} className={tab===value?"active":""} onClick={()=>setTab(value)}>{value==="overview"?"Resumen":value==="engine"?"Engine V2":value==="skills"?"Skills":value==="assets"?"Assets":"Legacy"}</button>)}
    </div>

    {tab==="overview"&&<div className="learningOverview">
      <article><span>Ediciones V2</span><strong>{engineV2?.events||0}</strong><small>cambios concretos de escenas</small></article>
      <article><span>Parámetros aprendidos</span><strong>{v2Parameters.length}</strong><small>posición, escala, tamaño y otros valores</small></article>
      <article><span>Skills evaluadas</span><strong>{skillRows.length}</strong><small>routing según aceptación/exportación</small></article>
      <article><span>Assets evaluados</span><strong>{assetRows.length}</strong><small>uso, permanencia y edición</small></article>
      <article><span>Preferencias</span><strong>{v2Preferences.length}</strong><small>ranking por contexto</small></article>
      <article><span>Privacidad</span><strong>Local</strong><small>IndexedDB del navegador</small></article>
    </div>}

    {tab==="engine"&&<div className="learningColumns">
      <div className="platformPanel"><h3>Parámetros aprendidos</h3>
        {!v2Parameters.length&&<p className="muted">Edita escenas en Studio para comenzar.</p>}
        <div className="learningTable">{v2Parameters.slice(0,80).map(row=><div className="learningRow four" key={row.path}>
          <div><strong>{row.path}</strong><small>{row.samples} muestras · confianza {(row.confidence*100).toFixed(0)}%</small></div>
          <span>{row.mean.toFixed(2)}</span><span>{row.min.toFixed(1)}–{row.max.toFixed(1)}</span><span>σ² {row.variance.toFixed(2)}</span>
        </div>)}</div>
      </div>
      <div className="platformPanel"><h3>Preferencias</h3>
        <div className="learningTable">{v2Preferences.slice(0,50).map(row=><div className="learningRow" key={row.key}>
          <div><strong>{row.key}</strong><small>{row.samples} muestras · +{row.positive} / -{row.negative}</small></div>
          <span>{(row.score*100).toFixed(1)}%</span><span>{row.samples}</span>
        </div>)}</div>
      </div>
    </div>}

    {tab==="skills"&&<div className="platformPanel"><h3>Ranking adaptativo de skills</h3>
      {!skillRows.length&&<p className="muted">Evalúa o exporta generaciones para alimentar el ranking.</p>}
      <div className="learningTable">{skillRows.map(row=><div className="learningRow four" key={row.id}>
        <div><strong>{row.id}</strong><small>{row.samples} muestras · calidad {Number(row.meanQuality||0).toFixed(1)}</small></div>
        <span>{(Number(row.score||0)*100).toFixed(1)}%</span><span>✓ {row.accepted||0}</span><span>⇩ {row.exports||0}</span>
      </div>)}</div>
    </div>}

    {tab==="assets"&&<div className="platformPanel"><h3>Ranking adaptativo de assets</h3>
      {!assetRows.length&&<p className="muted">Inserta y edita componentes desde el navegador de Assets.</p>}
      <div className="learningTable">{assetRows.map(row=><div className="learningRow four" key={row.id}>
        <div><strong>{row.id}</strong><small>{row.samples} usos · ediciones {Number(row.meanEdits||0).toFixed(1)}</small></div>
        <span>{(Number(row.score||0)*100).toFixed(1)}%</span><span>✓ {row.kept||0}</span><span>✕ {row.removed||0}</span>
      </div>)}</div>
    </div>}

    {tab==="legacy"&&<div className="platformPanel"><h3>Learning V1</h3>
      {!legacy&&<p className="muted">Sin snapshot V1.</p>}
      <div className="learningTable">{legacyRows.map(row=><div className="learningRow" key={row.key}>
        <div><strong>{row.key}</strong><small>{row.accepted} aceptadas · {row.rejected} rechazadas</small></div>
        <span>{row.meanQuality.toFixed(1)}</span><span>{row.score.toFixed(3)}</span>
      </div>)}</div>
    </div>}
  </section>;
}
