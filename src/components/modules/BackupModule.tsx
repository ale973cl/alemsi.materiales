"use client";
import {useState} from "react";

export default function BackupModule(){
 const [token,setToken]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function generate(){
  if(!token.trim()){setMessage("Ingresa la clave de respaldo de Admin Total.");return}
  setBusy(true);setMessage("Generando respaldo completo…");
  try{
   const res=await fetch("/api/admin/backup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});
   if(!res.ok){const j=await res.json().catch(()=>({}));throw new Error(j.error||"No fue posible generar el respaldo")}
   const blob=await res.blob();
   const disposition=res.headers.get("content-disposition")||"";
   const match=disposition.match(/filename="([^"]+)"/);
   const name=match?.[1]||`ALEMSI_Materiales_Backup_${new Date().toISOString().slice(0,10)}.zip`;
   const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
   setMessage("Respaldo generado y descargado. Guárdalo fuera de Supabase.");setToken("");
  }catch(e){setMessage(e instanceof Error?e.message:"Error al generar respaldo")}finally{setBusy(false)}
 }
 return <><h1>Respaldos</h1><p className="lead">Respaldo independiente de la base de datos. Disponible únicamente para Admin Total.</p>
  <div className="card backupCard"><h2>Generar respaldo completo</h2><p>Descarga un ZIP con un CSV por tabla, un JSON completo y un manifiesto de control. El proceso es de solo lectura sobre los datos operacionales.</p>
   <label className="fieldLabel">Clave de respaldo Admin Total</label><input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Clave protegida" autoComplete="off"/>
   <div><button className="btn primary large" disabled={busy} onClick={generate}>{busy?"Generando…":"Generar respaldo completo"}</button></div>
   {message&&<div className="notice">{message}</div>}
  </div>
  <div className="notice warning"><b>Importante:</b> este módulo no restaura, elimina ni sobrescribe datos. El archivo debe conservarse en un almacenamiento externo a Supabase.</div></>;
}
