"use client";
import {useState} from "react";
import {configureGuideSequence,getGuideSequenceStatus} from "@/app/guide-number-actions";
export default function GuideNumberSettings(){
 const [opened,setOpened]=useState(false),[loading,setLoading]=useState(false),[next,setNext]=useState(0),[highest,setHighest]=useState(0),[requested,setRequested]=useState(""),[message,setMessage]=useState("");
 const open=async()=>{setOpened(true);setLoading(true);setMessage("");try{const data=await getGuideSequenceStatus();setNext(data.next);setHighest(data.highest);setRequested(String(data.next))}catch(e:any){setMessage(e.message||"No se pudo consultar correlativo")}finally{setLoading(false)}};
 const save=async()=>{const value=Number(requested);if(!Number.isSafeInteger(value)||value<next||value>999999){setMessage(`El siguiente número debe estar entre ${next} y 999999.`);return}
  if(!window.confirm(`Configurar el próximo número de guía en ${"GI"+String(value).padStart(4,"0")}? No se modificarán guías existentes.`))return;
  setLoading(true);setMessage("");try{const result=await configureGuideSequence(value);setMessage(`Próxima guía: ${"GI"+String(result.next).padStart(4,"0")}. Configuración guardada.`);const data=await getGuideSequenceStatus();setNext(data.next);setHighest(data.highest);setRequested(String(data.next));}catch(e:any){setMessage(e.message||"No se pudo configurar");}finally{setLoading(false)}
 };
 return <section style={{margin:"10px 0",border:"1px solid #d2e2e7",borderRadius:12,padding:12,background:"#f8fbfc"}}>
  <button type="button" onClick={()=>opened?setOpened(false):void open()}>{opened?"Cerrar configuración":"Configurar correlativo de guías"}</button>
  {opened&&<div style={{display:"grid",gap:10,marginTop:12,maxWidth:530}}>
   <p style={{margin:0,fontSize:13}}>Numeración interna simple para ALEMSI: <b>GI0001, GI0002, GI0003…</b>. La fecha de creación, entrega y recepción queda dentro de la guía y en su historial; no forma parte del número visible.</p>
   {next>0&&<p style={{margin:0}}>Último número emitido: <b>{"GI"+String(highest).padStart(4,"0")}</b> · Próximo disponible: <b>{"GI"+String(next).padStart(4,"0")}</b></p>}
   <label style={{display:"grid",gap:4}}>Próximo correlativo a emitir<input type="number" min={Math.max(1,next)} max={999999} step={1} value={requested} onChange={e=>setRequested(e.target.value)} disabled={loading||!next}/></label>
   <button type="button" disabled={loading||!next} onClick={()=>void save()}>{loading?"Verificando…":"Guardar correlativo inicial"}</button>
   {message&&<p role="status" style={{margin:0,fontSize:13}}>{message}</p>}
  </div>}
 </section>;
}
