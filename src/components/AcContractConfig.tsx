"use client";
import {useEffect,useState} from "react";
import {monthRange,buildBudgetCurve,pasteExcelCurve} from "@/lib/ac-economic-engine";
type Month={mes:string;techo_neto_clp:number};
type Template={id:string;nombre:string;tipo:string;montos_neto_clp:number[]};
export default function AcContractConfig({contractId}:{contractId:string}){
 const [loading,setLoading]=useState(true),[available,setAvailable]=useState(false),[active,setActive]=useState(false);
 const [existing,setExisting]=useState<Month[]>([]),[templates,setTemplates]=useState<Template[]>([]);
 const [mode,setMode]=useState<"fija"|"variable"|"remanente">("fija"),[start,setStart]=useState(""),[end,setEnd]=useState("");
 const [fixed,setFixed]=useState(""),[paste,setPaste]=useState(""),[frequency,setFrequency]=useState("4"),[advance,setAdvance]=useState("15");
 const [templateId,setTemplateId]=useState(""),[templateName,setTemplateName]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const reload=async()=>{setLoading(true);try{const r=await fetch("/api/ac/contracts?contrato="+encodeURIComponent(contractId),{cache:"no-store"});const d=await r.json();
  if(!r.ok||!d.available)throw Error(d.reason||d.error||"Configuración no disponible");
  setAvailable(true);setActive(Boolean(d.contract.control_economico_activo));setExisting(d.months||[]);setTemplates(d.templates||[]);
  setFrequency(String(d.contract.frecuencia_ciclo_meses??4));setAdvance(String(d.contract.dias_anticipacion_alerta??15));
 }catch(e:any){setAvailable(false);setMessage(e.message)}finally{setLoading(false)}};
 useEffect(()=>{void reload()},[contractId]);
 const post=async(body:any)=>{setBusy(true);setMessage("");try{const r=await fetch("/api/ac/contracts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contractId,...body})});const data=await r.json();if(!r.ok)throw Error(data.error||"Error al guardar");setMessage(data.message);await reload()}catch(e:any){setMessage(e.message)}finally{setBusy(false)}};
 const preview=()=>{try{const values=paste.trim()?pasteExcelCurve(paste):templateId?templates.find(t=>t.id===templateId)?.montos_neto_clp||[]:undefined;
  return buildBudgetCurve({mode,start,end,fixedCLP:Number(fixed),values,todayMonth:new Date().toISOString().slice(0,7)}).map(x=>x.month+" · "+new Intl.NumberFormat("es-CL").format(x.netCLP)).join(" | ");
 }catch(e:any){return e.message}};
 return <div className="acContractConfig">
  <p>Configuración independiente por contrato. Sin presupuesto, los procesos de materiales siguen disponibles.</p>
  {loading?<p role="status">Cargando configuración…</p>:!available?<p role="status">{message||"Sin control presupuestario"}</p>:<>
   <strong>{active?"Control económico activo":"Sin control presupuestario"}</strong>
   <div className="acExistingMonths">{existing.map(m=><span key={m.mes}>{m.mes}: {new Intl.NumberFormat("es-CL").format(m.techo_neto_clp)}</span>)}</div>
   <div className="acConfigGrid">
    <label>Modalidad<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="fija">Monto fijo</option><option value="variable">Curva variable</option><option value="remanente">Solo meses remanentes</option></select></label>
    <label>Desde<input type="month" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label>Hasta<input type="month" value={end} onChange={e=>setEnd(e.target.value)}/></label>
    {mode==="fija"?<label>Base neta mensual (CLP)<input type="number" min="0" value={fixed} onChange={e=>setFixed(e.target.value)}/></label>:<>
     <label>Plantilla<select value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">Ingresar valores</option>{templates.map(t=><option value={t.id} key={t.id}>{t.nombre}</option>)}</select></label>
     {!templateId&&<label className="acWide">Pegar fila Excel (separada por tabulaciones)<textarea value={paste} rows={2} onChange={e=>setPaste(e.target.value)} placeholder="120.000    90.000    70.000"/></label>}
    </>}
    <label>Frecuencia del ciclo (meses)<input type="number" min="1" max="24" value={frequency} onChange={e=>setFrequency(e.target.value)}/></label>
    <label>Días anticipación<input type="number" min="0" max="365" value={advance} onChange={e=>setAdvance(e.target.value)}/></label>
   </div>
   <p className="acPreviewCurve">Vista previa: {start&&end?preview():"Selecciona los meses"}</p>
   <div className="acConfigActions"><button type="button" disabled={busy||!start||!end} onClick={()=>void post({action:"save",mode,start,end,fixedCLP:Number(fixed),paste:templateId?"":paste,templateId:templateId||null,frequency:Number(frequency),advance:Number(advance)})}>{busy?"Guardando…":"Guardar curva y activar"}</button>
    <button type="button" disabled={busy||!active} onClick={()=>void post({action:"disable"})}>Desactivar sin borrar histórico</button>
   </div>
   {mode!=="fija"&&!templateId&&paste.trim()&&<div className="acConfigActions"><input value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="Nombre de plantilla" aria-label="Nombre de plantilla"/><button type="button" disabled={busy||!templateName.trim()} onClick={()=>{try{const amounts=pasteExcelCurve(paste);void post({action:"template",name:templateName,type:"variable",amounts})}catch(e:any){setMessage(e.message)}}}>Guardar plantilla</button></div>}
   {message&&<p role="status">{message}</p>}
  </>}
 </div>;
}
