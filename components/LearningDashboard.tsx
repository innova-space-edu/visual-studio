"use client";

import {useEffect,useMemo,useState} from "react";
import {
  VisualLearningEngine,VisualLearningEngineV2,
  type LearningSnapshot,type LearningSnapshotV2
} from "@innova-space/visual-engine";
import {loadLearningSnapshot} from "@/lib/persistence";

type Tab="overview"|"runs"|"edits"|"skills"|"assets"|"experiments"|"candidates"|"regressions"|"versions"|"legacy";

function pct(value:any){const n=Number(value);return Number.isFinite(n)?(n*100).toFixed(1)+"%":"—";}
function num(value:any,digits=1){const n=Number(value);return Number.isFinite(n)?n.toFixed(digits):"—";}
function when(value:any){if(!value)return "—";try{return new Date(value).toLocaleString();}catch{return String(value);}}
function statusClass(value:string){return ["approved","recommended","passed","completed","released"].includes(value)?"learningGood":["failed","rejected","error","cancelled"].includes(value)?"learningBad":"learningNeutral";}

export default function LearningDashboard(){
  const [tab,setTab]=useState<Tab>("overview");
  const [legacy,setLegacy]=useState<LearningSnapshot|null>(null);
  const [engineV2,setEngineV2]=useState<LearningSnapshotV2|null>(null);
  const [skills,setSkills]=useState<any>(null);
  const [assets,setAssets]=useState<any>(null);
  const [cloud,setCloud]=useState<any>(null);
  const [cloudError,setCloudError]=useState("");
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [scanSkill,setScanSkill]=useState("");
  const [experimentKey,setExperimentKey]=useState("");
  const [experimentSkill,setExperimentSkill]=useState("");
  const [experimentArms,setExperimentArms]=useState("A,B");

  async function refreshCloud(){
    try{
      const res=await fetch("/api/learning/intelligence",{cache:"no-store"});
      const payload=await res.json();
      if(!res.ok)throw new Error(payload?.error||("Learning API "+res.status));
      setCloud(payload);setCloudError("");
    }catch(error){setCloudError(String(error));}
  }

  useEffect(()=>{
    Promise.all([
      loadLearningSnapshot<LearningSnapshot>("default"),
      loadLearningSnapshot<LearningSnapshotV2>("engine-v2"),
      loadLearningSnapshot<any>("skills-v1"),
      loadLearningSnapshot<any>("assets-v1")
    ]).then(([a,b,c,d])=>{setLegacy(a);setEngineV2(b);setSkills(c);setAssets(d);});
    void refreshCloud();
  },[]);

  async function action(name:string,payload:Record<string,unknown>={}){
    setBusy(name);setMessage("");
    try{
      const res=await fetch("/api/learning/intelligence",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:name,...payload})
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data?.error||("Learning action "+res.status));
      setMessage("Acción completada: "+name);
      await refreshCloud();
      return data;
    }catch(error){setMessage(String(error));return null;}
    finally{setBusy("");}
  }

  const legacyRows=useMemo(()=>{
    if(!legacy)return [];
    const engine=new VisualLearningEngine();engine.restore(legacy);
    return engine.rank(Object.keys(legacy.stats));
  },[legacy]);

  const v2Parameters=useMemo(()=>Object.values(engineV2?.parameters||{}).sort((a,b)=>b.samples-a.samples),[engineV2]);
  const v2Preferences=useMemo(()=>Object.values(engineV2?.preferences||{}).sort((a,b)=>b.score-a.score),[engineV2]);
  const skillRows=useMemo(()=>Object.values(skills?.stats||{}).sort((a:any,b:any)=>b.score-a.score) as any[],[skills]);
  const assetRows=useMemo(()=>Object.values(assets?.stats||{}).sort((a:any,b:any)=>b.score-a.score) as any[],[assets]);
  const runs=cloud?.runs||[],observations=cloud?.observations||[],candidates=cloud?.candidates||[],regressions=cloud?.regressions||[],experiments=cloud?.experiments||[],releases=cloud?.releases||[];

  const totalSignals=(engineV2?.events||0)+skillRows.reduce((sum,row)=>sum+Number(row.samples||0),0)+assetRows.reduce((sum,row)=>sum+Number(row.samples||0),0)+observations.length;

  async function createExperiment(){
    const arms=experimentArms.split(",").map(x=>x.trim()).filter(Boolean);
    if(!experimentKey.trim()||arms.length<2){setMessage("Define una clave y al menos dos brazos.");return;}
    const data=await action("experiment-create",{experimentKey:experimentKey.trim(),skill:experimentSkill.trim()||null,arms,minSamples:20});
    if(data){setExperimentKey("");setExperimentArms("A,B");}
  }

  async function recordExperiment(exp:any){
    const arm=window.prompt("Brazo usado",Array.isArray(exp.arms)?String(typeof exp.arms[0]==="string"?exp.arms[0]:exp.arms[0]?.id||"A"):"A");
    if(!arm)return;
    const accepted=window.confirm("¿El resultado fue aceptado?");
    const quality=Number(window.prompt("Quality score (0-100)","90")||90);
    const edits=Number(window.prompt("Cantidad de ediciones","0")||0);
    await action("experiment-record",{experimentId:exp.id,arm,accepted,exported:accepted,quality,edits});
  }

  async function scheduleRelease(candidate:any){
    const date=new Date(Date.now()+2*24*60*60*1000);
    await action("release-create",{candidateIds:[candidate.id],scheduledFor:date.toISOString()});
  }

  const tabs:Tab[]=["overview","runs","edits","skills","assets","experiments","candidates","regressions","versions","legacy"];
  const label=(value:Tab)=>({
    overview:"Resumen",runs:"Runs",edits:"Edits",skills:"Skills",assets:"Assets",experiments:"Experimentos",
    candidates:"Candidatos",regressions:"Regresiones",versions:"Versiones",legacy:"Legacy"
  }[value]);

  return <section className="learningSuite">
    <div className="learningHero">
      <div>
        <span className="eyebrow">VISUAL LEARNING INTELLIGENCE V5</span>
        <h2>Aprendizaje continuo, validado y administrado</h2>
        <p className="muted">El contenido completo permanece local; la nube prioriza telemetría estructurada, hashes, resultados y evidencia necesaria para mejorar el motor.</p>
      </div>
      <div className="learningHeroMetric"><span>Señales</span><strong>{totalSignals}</strong></div>
    </div>

    {cloudError&&<div className="learningNotice bad">Cloud: {cloudError}</div>}
    {message&&<div className="learningNotice">{message}</div>}

    <div className="learningTabs">
      {tabs.map(value=><button key={value} className={tab===value?"active":""} onClick={()=>setTab(value)}>{label(value)}</button>)}
    </div>

    {tab==="overview"&&<>
      <div className="learningOverview">
        <article><span>Runs cloud</span><strong>{runs.length}</strong><small>ejecuciones recientes indexadas</small></article>
        <article><span>Observaciones</span><strong>{observations.length}</strong><small>cambios estructurados consultables</small></article>
        <article><span>Candidatos</span><strong>{candidates.length}</strong><small>ninguno modifica producción automáticamente</small></article>
        <article><span>Regresiones</span><strong>{regressions.length}</strong><small>validaciones actuales vs candidato</small></article>
        <article><span>Experimentos</span><strong>{experiments.length}</strong><small>A/B o multibrazo determinista</small></article>
        <article><span>Privacidad</span><strong>Local + hash</strong><small>texto bruto no requerido por el índice cloud</small></article>
      </div>
      <div className="learningColumns">
        <div className="platformPanel">
          <h3>Motor local</h3>
          <div className="learningTable">
            <div className="learningRow"><div><strong>Learning Engine V2</strong><small>parámetros aprendidos</small></div><span>{v2Parameters.length}</span><span>{engineV2?.events||0} eventos</span></div>
            <div className="learningRow"><div><strong>Skills adaptativas</strong><small>aceptación, calidad, exportación y edición</small></div><span>{skillRows.length}</span><span>local</span></div>
            <div className="learningRow"><div><strong>Assets adaptativos</strong><small>ranking global y contextual</small></div><span>{assetRows.length}</span><span>local</span></div>
          </div>
        </div>
        <div className="platformPanel">
          <h3>Flujo de promoción</h3>
          <div className="learningFlow">
            <span>LEARNING</span><b>→</b><span>CANDIDATE</span><b>→</b><span>REGRESSION</span><b>→</b><span>RECOMMENDED</span><b>→</b><span>APPROVED</span>
          </div>
          <p className="muted">Solo el administrador puede aprobar. La fase V5 no aplica cambios de parámetros a producción automáticamente.</p>
        </div>
      </div>
    </>}

    {tab==="runs"&&<div className="platformPanel">
      <h3>Runs recientes</h3>
      {!runs.length&&<p className="muted">Aún no hay runs sincronizados.</p>}
      <div className="learningTable">{runs.map((row:any)=><div className="learningRow learningWide" key={row.run_id}>
        <div><strong>{row.skill||"sin skill"}</strong><small>{row.run_id} · {when(row.created_at)}</small></div>
        <span>{num(row.quality_before,0)} → {num(row.quality_after,0)}</span>
        <span>{row.accepted===true?"✓ aceptado":row.accepted===false?"✕ rechazado":"—"}</span>
        <span>{row.exported?"exportado":"sin exportar"}</span>
      </div>)}</div>
    </div>}

    {tab==="edits"&&<div className="platformPanel">
      <h3>Ediciones estructuradas</h3>
      {!observations.length&&<p className="muted">Las próximas ediciones sincronizadas aparecerán aquí.</p>}
      <div className="learningTable">{observations.map((row:any)=><div className="learningRow learningWide" key={row.id}>
        <div><strong>{row.node_type||"node"} · {row.feature}</strong><small>{row.skill||"sin skill"} · {when(row.occurred_at)}</small></div>
        <span>{row.before_value==null?"—":num(row.before_value,2)} → {row.after_value==null?"—":num(row.after_value,2)}</span>
        <span>Δ {row.delta==null?"—":num(row.delta,2)}</span>
        <span>{row.accepted===true?"aceptado":row.exported?"exportado":"observado"}</span>
      </div>)}</div>
    </div>}

    {tab==="skills"&&<div className="platformPanel"><h3>Ranking adaptativo de skills</h3>
      {!skillRows.length&&<p className="muted">Evalúa o exporta generaciones para alimentar el ranking.</p>}
      <div className="learningTable">{skillRows.map((row:any)=><div className="learningRow four" key={row.id}>
        <div><strong>{row.id}</strong><small>{row.samples} muestras · calidad {Number(row.meanQuality||0).toFixed(1)}</small></div>
        <span>{pct(row.score)}</span><span>✓ {row.accepted||0}</span><span>⇩ {row.exports||0}</span>
      </div>)}</div>
    </div>}

    {tab==="assets"&&<div className="platformPanel"><h3>Ranking adaptativo de assets</h3>
      {!assetRows.length&&<p className="muted">Inserta y edita componentes desde el navegador de Assets.</p>}
      <div className="learningTable">{assetRows.map((row:any)=><div className="learningRow four" key={row.id}>
        <div><strong>{row.id}</strong><small>{row.samples} usos · ediciones {Number(row.meanEdits||0).toFixed(1)}</small></div>
        <span>{pct(row.score)}</span><span>✓ {row.kept||0}</span><span>✕ {row.removed||0}</span>
      </div>)}</div>
    </div>}

    {tab==="experiments"&&<>
      <div className="learningControl">
        <div><h3>Nuevo experimento</h3><p className="muted">Crea brazos A/B o múltiples. No cambia producción por sí solo.</p></div>
        <input placeholder="clave: formula-position" value={experimentKey} onChange={e=>setExperimentKey(e.target.value)}/>
        <input placeholder="skill opcional" value={experimentSkill} onChange={e=>setExperimentSkill(e.target.value)}/>
        <input placeholder="A,B" value={experimentArms} onChange={e=>setExperimentArms(e.target.value)}/>
        <button onClick={createExperiment} disabled={!!busy}>Crear</button>
      </div>
      <div className="learningCards">{experiments.map((exp:any)=><article className="learningCard" key={exp.id}>
        <div className="learningCardHead"><strong>{exp.experiment_key}</strong><span className={statusClass(exp.status)}>{exp.status}</span></div>
        <p>{exp.skill||"global"} · mínimo {exp.min_samples_per_arm} por brazo</p>
        <small>Brazos: {Array.isArray(exp.arms)?exp.arms.map((a:any)=>typeof a==="string"?a:a.id).join(", "):"—"}</small>
        <small>Ganador: {exp.winner||"pendiente"} · confianza {pct(exp.confidence)}</small>
        <div className="learningCardActions"><button onClick={()=>action("experiment-choose",{experimentId:exp.id})}>Elegir brazo</button><button onClick={()=>recordExperiment(exp)} disabled={exp.status!=="running"}>Registrar resultado</button></div>
      </article>)}</div>
    </>}

    {tab==="candidates"&&<>
      <div className="learningControl">
        <div><h3>Visual Optimizer</h3><p className="muted">20+ observaciones consistentes antes de proponer cambios.</p></div>
        <input placeholder="skill, p. ej. chemistry-diagram" value={scanSkill} onChange={e=>setScanSkill(e.target.value)}/>
        <button disabled={!!busy} onClick={()=>action("scan",scanSkill.trim()?{skill:scanSkill.trim()}:{})}>{busy==="scan"?"Analizando…":"Analizar evidencia"}</button>
      </div>
      <div className="learningCards">{candidates.map((candidate:any)=><article className="learningCard" key={candidate.id}>
        <div className="learningCardHead"><strong>{candidate.skill}</strong><span className={statusClass(candidate.status)}>{candidate.status}</span></div>
        <p>{candidate.current_version||"actual"} → {candidate.candidate_version||"candidate"}</p>
        <small>{candidate.sample_count} muestras · confianza {pct(candidate.confidence)} · {Object.keys(candidate.proposal?.changes||{}).length} cambios</small>
        <div className="learningCardActions">
          <button onClick={()=>action("regress",{candidateId:candidate.id})} disabled={!!busy}>Regresión</button>
          {candidate.status==="recommended"&&<button onClick={()=>action("candidate-status",{candidateId:candidate.id,status:"approved"})}>Aprobar</button>}
          {["candidate","recommended"].includes(candidate.status)&&<button onClick={()=>action("candidate-status",{candidateId:candidate.id,status:"rejected"})}>Rechazar</button>}
          {candidate.status==="approved"&&<button onClick={()=>scheduleRelease(candidate)}>Programar +2 días</button>}
        </div>
      </article>)}</div>
    </>}

    {tab==="regressions"&&<div className="platformPanel"><h3>Visual Regression</h3>
      {!regressions.length&&<p className="muted">Las regresiones aparecen cuando exista un candidato con evidencia suficiente.</p>}
      <div className="learningTable">{regressions.map((row:any)=><div className="learningRow learningWide" key={row.id}>
        <div><strong>{row.status==="passed"?"✓ PASS":"✕ FAIL"}</strong><small>{row.cases} casos · {row.passed_cases} pasan · {when(row.created_at)}</small></div>
        <span>Q {num(row.delta_metrics?.quality,1)}</span>
        <span>Sem {num(row.delta_metrics?.semantic,1)}</span>
        <span>Overflow {num(row.delta_metrics?.overflow,0)}</span>
      </div>)}</div>
    </div>}

    {tab==="versions"&&<div className="platformPanel"><h3>Versiones y ventana de actualización</h3>
      {!releases.length&&<p className="muted">Cuando apruebes un candidato puedes programarlo. La fecha de aviso queda D-2 automáticamente.</p>}
      <div className="learningCards">{releases.map((release:any)=><article className="learningCard" key={release.id}>
        <div className="learningCardHead"><strong>{release.version}</strong><span className={statusClass(release.status)}>{release.status}</span></div>
        <small>Aviso admin: {when(release.notify_at)}</small>
        <small>Ventana propuesta: {when(release.scheduled_for)}</small>
        <small>Candidatos: {Array.isArray(release.candidate_ids)?release.candidate_ids.length:0}</small>
        {release.status==="scheduled"&&<div className="learningCardActions"><button onClick={()=>action("release-approve",{releaseId:release.id})}>Aprobar versión</button></div>}
      </article>)}</div>
    </div>}

    {tab==="legacy"&&<div className="learningColumns">
      <div className="platformPanel"><h3>Learning Engine V2</h3>
        <div className="learningTable">{v2Parameters.slice(0,80).map((row:any)=><div className="learningRow four" key={row.path}>
          <div><strong>{row.path}</strong><small>{row.samples} muestras · confianza {(row.confidence*100).toFixed(0)}%</small></div>
          <span>{row.mean.toFixed(2)}</span><span>{row.min.toFixed(1)}–{row.max.toFixed(1)}</span><span>σ² {row.variance.toFixed(2)}</span>
        </div>)}</div>
      </div>
      <div className="platformPanel"><h3>Learning V1</h3>
        <div className="learningTable">{legacyRows.map((row:any)=><div className="learningRow" key={row.key}>
          <div><strong>{row.key}</strong><small>{row.accepted} aceptadas · {row.rejected} rechazadas</small></div>
          <span>{row.meanQuality.toFixed(1)}</span><span>{row.score.toFixed(3)}</span>
        </div>)}</div>
      </div>
    </div>}
  </section>;
}
