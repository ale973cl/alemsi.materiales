"use client";
import {useEffect,useState} from "react";
import {configureGuideSequence,getGuideSequenceStatus} from "@/app/guide-number-actions";

export default function GuideNumberSettings(){
 const [loading,setLoading]=useState(true),[next,setNext]=useState(0),[highest,setHighest]=useState(0),[requested,setRequested]=useState(""),[message,setMessage]=useState("");
 const load=async()=>{setLoading(true);setMessage("");try{const data=await getGuideSequenceStatus();setNext(data.next);setHighest(data.highest);setRequested(String(data.next))}catch(e:any){setMessage(e.message||"No se pudo consultar correlativo")}finally{setLoading(false)}};
 useEffect(()=>{void load()},[]);
 const save=async()=>{const value=Number(requested);if(!Number.isSafeInteger(value)||value<Math.max(1,next)||value>999999){setMessage("Revisa el próximo número a emitir.");return}
  if(!window.confirm("Configurar el próximo número de guía interna en GI"+String(value).padStart(4,"0")+"?"))return;
  setLoading(true);setMessage("");try{const result=await configureGuideSequence(value);setMessage("Próxima guía: GI"+String(result.next).padStart(4,"0")+". Configuración guardada.");await load()}catch(e:any){setMessage(e.message||"No se pudo configurar");setLoading(false)}
 };
 return <section className="guideSettingsDirect">
  <p>Numeración interna simple: <b>GI0001, GI0002, GI0003…</b>. La fecha y recepción quedan dentro de la guía, no en el correlativo.</p>
  {next>0&&<p>Última emitida: <b>{"GI"+String(highest).padStart(4,"0")}</b> · Próxima: <b>{"GI"+String(next).padStart(4,"0")}</b></p>}
  <label>Próximo correlativo<input type="number" min={Math.max(1,next)} max={999999} step={1} value={requested} onChange={e=>setRequested(e.target.value)} disabled={loading||!next}/></label>
  <button type="button" disabled={loading||!next} onClick={()=>void save()}>{loading?"Verificando…":"Guardar correlativo"}</button>
  {message&&<p role="status" className="note">{message}</p>}
 </section>;
}
