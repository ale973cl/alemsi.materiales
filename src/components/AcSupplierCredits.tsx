"use client";
import {useEffect,useMemo,useState} from "react";
type Invoice={id:string;folio:string;supplier:string;issueDate:string|null;siiReceiptDate:string|null;paymentTerms:"Contado"|"Crédito"|"Sin Costo";creditDays:number;totalCLP:number;paidCLP:number;configured:boolean;dueDate:string|null;claimDeadline:string|null;state:string;lateDays:number;outstandingCLP:number;remainingDays:number|null};
const money=(v:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(v);
export default function AcSupplierCredits(){
 const [rows,setRows]=useState<Invoice[]>([]),[available,setAvailable]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [open,setOpen]=useState(""),[terms,setTerms]=useState<"Crédito"|"Contado"|"Sin Costo">("Crédito"),[days,setDays]=useState(30),[sii,setSii]=useState(""),[issue,setIssue]=useState("");
 const [pay,setPay]=useState(""),[date,setDate]=useState(""),[reference,setReference]=useState("");
 const load=async()=>{try{const res=await fetch("/api/ac/credits",{cache:"no-store"});const data=await res.json();if(!res.ok)throw Error(data.error||"No se pudo cargar vencimientos");setAvailable(Boolean(data.available));setRows(data.rows||[]);setMessage(data.reason||"")}catch(e:any){setAvailable(false);setMessage(e.message)}};
 useEffect(()=>{void load()},[]);
 const selected=rows.find(r=>r.id===open);
 const summary=useMemo(()=>({late:rows.filter(r=>r.state==="Vencida").length,soon:rows.filter(r=>r.state==="Por Vencer").length,unconfigured:rows.filter(r=>!r.configured).length}),[rows]);
 const save=async(payload:any)=>{setBusy(true);setMessage("");try{const res=await fetch("/api/ac/credits",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({receiptId:open,...payload})});const data=await res.json();if(!res.ok)throw Error(data.error||"Error al registrar");setMessage(data.message);await load()}catch(e:any){setMessage(e.message)}finally{setBusy(false)}};
 return <section className="panel acSupplierCredits"><div className="acOverviewHead"><h3>Vencimientos de proveedores</h3><span>Facturas y días de crédito</span></div>
  {available===null?<p role="status">Cargando facturas…</p>:!available?<p role="status">{message||"Sin control de vencimientos configurado"}. La recepción de documentos continúa disponible.</p>:<>
   <div className="acCreditSummary"><span>Vencidas <b>{summary.late}</b></span><span>Por vencer (5 días) <b>{summary.soon}</b></span><span>Sin configurar <b>{summary.unconfigured}</b></span></div>
   <div className="acCreditList">{rows.map(r=><button type="button" key={r.id} className={open===r.id?"selected":""} onClick={()=>{setOpen(r.id);setTerms(r.paymentTerms);setDays(r.creditDays);setSii(r.siiReceiptDate||"");setIssue(r.issueDate||"");setPay("");setReference("");setDate("")}}>
    <span><b>{r.supplier}</b><small>{r.folio} · {r.state} {r.lateDays>0?"("+r.lateDays+" días de mora)":""}</small></span><strong>{money(r.outstandingCLP)}</strong><small>Vence {r.dueDate||"Sin fecha SII"}</small></button>)}</div>
   {!rows.length&&<p>No se encontraron facturas en la consulta autorizada.</p>}
   {selected&&<div className="acCreditEditor"><h4>{selected.folio} · {selected.supplier}</h4><p>Registro manual del hito de recepción SII. No se infiere de la fecha de emisión ni de la carga a inventario.</p>
    <div className="acConfigGrid">
     <label>Condición<select value={terms} onChange={e=>setTerms(e.target.value as typeof terms)}><option>Crédito</option><option>Contado</option><option>Sin Costo</option></select></label>
     <label>Días crédito<input type="number" min="0" max="3650" value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
     <label>Emisión<input type="date" value={issue} onChange={e=>setIssue(e.target.value)}/></label>
     <label>Recepción SII<input type="date" value={sii} onChange={e=>setSii(e.target.value)}/></label>
    </div>
    <p>Vencimiento: {selected.dueDate||"Pendiente de fecha SII"} · Límite de reclamo: {selected.claimDeadline||"No calculable"}</p>
    <div className="acConfigActions"><button type="button" disabled={busy} onClick={()=>void save({action:"terms",paymentTerms:terms,creditDays:days,siiReceiptDate:sii||null,issueDate:issue||null})}>{busy?"Guardando…":"Guardar condiciones"}</button></div>
    <h4>Registrar pago acreditado</h4><div className="acConfigGrid"><label>Monto CLP<input type="number" min="1" value={pay} onChange={e=>setPay(e.target.value)}/></label><label>Fecha de pago<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Referencia comprobante<input value={reference} onChange={e=>setReference(e.target.value)}/></label></div>
    <button type="button" disabled={busy||!pay||!date||!reference.trim()} onClick={()=>void save({action:"payment",amount:Number(pay),date,reference})}>{busy?"Registrando…":"Acreditar pago"}</button>
   </div>}
   {message&&<p role="status">{message}</p>}
  </>}
 </section>;
}
