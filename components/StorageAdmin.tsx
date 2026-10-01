"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {
  getLearningOutboxStats,installLearningAutoSync,syncLearningOutbox
} from "@/lib/persistence";

type StatusPayload={
  configured?:{supabase:boolean;googleOAuth:boolean;dedicatedEncryptionKey:boolean;adminAllowlist:boolean};
  drive?:{
    connected:boolean;status:string;email:string|null;accountName:string|null;rootFolderId:string|null;
    folderCount:number|null;lastSyncAt:string|null;lastError:string|null;
    storageQuota?:{limit?:string;usage?:string;usageInDrive?:string};
  };
  summary?:{batches:number;runs:number;jobs:number};
  admin?:boolean;
  error?:string;
};

function bytes(value?:string|null){
  const n=Number(value||0);
  if(!Number.isFinite(n)||n<=0)return "—";
  const units=["B","KB","MB","GB","TB"];
  let v=n,i=0;
  while(v>=1024&&i<units.length-1){v/=1024;i++;}
  return v.toFixed(i>=3?2:1)+" "+units[i];
}

function date(value?:string|null){
  if(!value)return "Nunca";
  try{return new Date(value).toLocaleString();}catch{return value;}
}

export default function StorageAdmin(){
  const [cloud,setCloud]=useState<StatusPayload|null>(null);
  const [local,setLocal]=useState({pending:0,synced:0,total:0,failed:0,oldestPendingAt:null as number|null});
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  async function refresh(){
    const [res,outbox]=await Promise.all([
      fetch("/api/learning/storage/status",{cache:"no-store"}).then(r=>r.json()),
      getLearningOutboxStats()
    ]);
    setCloud(res);setLocal(outbox);
  }

  useEffect(()=>{
    const stop=installLearningAutoSync();
    void refresh();
    const params=new URLSearchParams(window.location.search);
    if(params.get("connected")==="1")setMessage("Google Drive conectado y carpetas creadas.");
    if(params.get("error"))setMessage("OAuth: "+decodeURIComponent(params.get("error")||""));
    return stop;
  },[]);

  async function testDrive(){
    setBusy("test");setMessage("");
    try{
      const res=await fetch("/api/learning/storage/test",{method:"POST"});
      const payload=await res.json();
      if(!res.ok)throw new Error(payload?.error||"No fue posible probar Drive");
      setMessage("Drive operativo · "+String(payload.email||"cuenta conectada"));
      await refresh();
    }catch(error){setMessage(String(error));}
    finally{setBusy("");}
  }

  async function syncNow(){
    setBusy("sync");setMessage("");
    try{
      const result:any=await syncLearningOutbox(true);
      if(!result.ok)throw new Error(result.error||"No fue posible sincronizar");
      setMessage(result.synced?"Sincronizados "+result.synced+" eventos.":"No hay eventos pendientes.");
      await refresh();
    }catch(error){setMessage(String(error));}
    finally{setBusy("");}
  }

  const drive=cloud?.drive;
  const quota=drive?.storageQuota;

  return <main className="storagePage">
    <header className="storageHeader">
      <div>
        <span className="eyebrow">VISUAL LEARNING CLOUD</span>
        <h1>Almacenamiento y sincronización</h1>
        <p>IndexedDB mantiene la cola local; Google Drive guarda el volumen masivo; Supabase conserva índices y estado.</p>
      </div>
      <div className="storageHeaderActions">
        <Link className="navLink" href="/learning">Learning</Link>
        <Link className="navLink" href="/">Studio</Link>
      </div>
    </header>

    {message&&<div className="storageNotice">{message}</div>}

    <section className="storageGrid">
      <article className="storageCard">
        <div className="storageCardHead"><div><span className="eyebrow">LOCAL</span><h2>IndexedDB</h2></div><span className="storageOk">Activo</span></div>
        <div className="storageMetrics">
          <div><span>Pendientes</span><strong>{local.pending}</strong></div>
          <div><span>Sincronizados</span><strong>{local.synced}</strong></div>
          <div><span>Con error</span><strong>{local.failed}</strong></div>
        </div>
        <p className="muted">Los eventos se conservan localmente aunque no haya conexión. Los sincronizados se mantienen 7 días antes de podarse.</p>
        <button className="wideButton" disabled={busy==="sync"} onClick={syncNow}>{busy==="sync"?"Sincronizando…":"Sincronizar ahora"}</button>
      </article>

      <article className="storageCard">
        <div className="storageCardHead"><div><span className="eyebrow">BULK STORAGE</span><h2>Google Drive</h2></div><span className={drive?.connected?"storageOk":"storageWarn"}>{drive?.connected?"Conectado":"Sin conectar"}</span></div>
        <div className="storageRows">
          <div><span>Cuenta</span><strong>{drive?.email||"—"}</strong></div>
          <div><span>Carpetas administradas</span><strong>{drive?.folderCount??"—"}</strong></div>
          <div><span>Última sincronización</span><strong>{date(drive?.lastSyncAt)}</strong></div>
          <div><span>Uso Drive</span><strong>{bytes(quota?.usageInDrive||quota?.usage)} / {bytes(quota?.limit)}</strong></div>
        </div>
        {drive?.lastError&&<p className="error">{drive.lastError}</p>}
        <div className="storageButtons">
          <button onClick={()=>window.location.assign("/api/auth/google-drive/start")}>{drive?.connected?"Reconectar Drive":"Conectar Google Drive"}</button>
          <button disabled={!drive?.connected||!cloud?.admin||busy==="test"} onClick={testDrive}>{busy==="test"?"Probando…":"Probar conexión"}</button>
        </div>
      </article>

      <article className="storageCard">
        <div className="storageCardHead"><div><span className="eyebrow">INDEX</span><h2>Supabase</h2></div><span className={cloud?.configured?.supabase?"storageOk":"storageWarn"}>{cloud?.configured?.supabase?"Configurado":"Falta configuración"}</span></div>
        <div className="storageMetrics">
          <div><span>Lotes</span><strong>{cloud?.summary?.batches??0}</strong></div>
          <div><span>Runs</span><strong>{cloud?.summary?.runs??0}</strong></div>
          <div><span>Jobs</span><strong>{cloud?.summary?.jobs??0}</strong></div>
        </div>
        <p className="muted">Supabase no almacena los blobs grandes. Guarda hashes, referencias de Drive, métricas y estados para búsquedas rápidas.</p>
      </article>

      <article className="storageCard">
        <div className="storageCardHead"><div><span className="eyebrow">SECURITY</span><h2>Protección</h2></div><span className={cloud?.admin?"storageOk":"storageWarn"}>{cloud?.admin?"Admin verificado":"Sesión admin no verificada"}</span></div>
        <div className="storageRows">
          <div><span>OAuth Google</span><strong>{cloud?.configured?.googleOAuth?"Listo":"Faltan variables"}</strong></div>
          <div><span>RLS Supabase</span><strong>Cliente bloqueado</strong></div>
          <div><span>Cifrado refresh token</span><strong>{cloud?.configured?.dedicatedEncryptionKey?"Clave dedicada":"Derivada del OAuth secret"}</strong></div>
          <div><span>Allowlist admin</span><strong>{cloud?.configured?.adminAllowlist?"Activa":"No configurada"}</strong></div>
        </div>
        {!cloud?.configured?.dedicatedEncryptionKey&&<p className="storageHint">Funciona así, pero para desacoplar rotaciones OAuth conviene agregar <code>LEARNING_TOKEN_ENCRYPTION_KEY</code> más adelante.</p>}
      </article>
    </section>
  </main>;
}
