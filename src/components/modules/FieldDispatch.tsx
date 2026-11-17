"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import DeliveryRegistrationModal from "./DeliveryRegistrationModal";

type Stop={id:string;dispatch_id:string;delivery_order:number;dispatches:any};
type Route={id:string;route_name:string;planned_date:string;status:string;delivery_assignee_id:string|null;delivery_route_dispatches:Stop[]};
const processed=new Set(["Entregado conforme","Entrega con observaciones","Entrega parcial regularizada","Entrega parcial","Rechazado/No entregado"]);
const closed=new Set(["Anulado"]);
export default function FieldDispatch({userId,operatorName}:{userId:string;operatorName:string}){
 const [routes,setRoutes]=useState<Route[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[selected,setSelected]=useState(""),[tab,setTab]=useState<"active"|"processed">("active"),[delivery,setDelivery]=useState<any>(null);
 const reload=useCallback(async()=>{try{const response=await fetch("/api/delivery-routes",{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error||"No se pudieron cargar las rutas");setRoutes(body.routes||[]);setError("")}catch(e:any){setError(e.message||"Error de conexión")}finally{setLoading(false)}},[]);
 useEffect(()=>{void reload()},[reload]);
 const mine=useMemo(()=>routes.filter(r=>r.delivery_assignee_id===userId&&!closed.has(r.status)),[routes,userId]);
 const free=useMemo(()=>routes.filter(r=>!r.delivery_assignee_id&&!closed.has(r.status)),[routes]);
 const route=mine.find(r=>r.id===selected)||mine.find(r=>(r.delivery_route_dispatches||[]).some(s=>!processed.has(s.dispatches?.status)))||mine[0];
 const stops=[...(route?.delivery_route_dispatches||[])].sort((a,b)=>Number(a.delivery_order)-Number(b.delivery_order));
 const pending=stops.filter(s=>!processed.has(s.dispatches?.status)&&!closed.has(s.dispatches?.status));
 const done=stops.filter(s=>processed.has(s.dispatches?.status));
 const claim=async(id:string)=>{setBusy(true);try{const {claimAvailableDeliveryRoute}=await import("@/app/route-actions");await claimAvailableDeliveryRoute(id);await reload();setSelected(id);setTab("active")}catch(e:any){setError(e.message||"No se pudo tomar la ruta")}finally{setBusy(false)}};
 return <main className="fieldDispatch">
  <header className="fieldHeader"><div><small>ALEMSI MATERIALES</small><h1>Despacho en Terreno</h1><span>{operatorName}</span></div><Link href="/">Inicio</Link></header>
  {error&&<p role="alert" className="fieldError">{error} <button onClick={()=>void reload()}>Reintentar</button></p>}
  {loading?<p>Cargando rutas…</p>:<>
   {mine.length>1&&<label className="fieldSelect">Mi ruta<select value={route?.id||""} onChange={e=>{setSelected(e.target.value);setTab("active")}}>{mine.map(r=><option value={r.id} key={r.id}>{r.route_name}</option>)}</select></label>}
   {route?<><section className="fieldProgress"><strong>{route.route_name}</strong><span>{route.planned_date} · {done.length} de {stops.length} procesadas</span><progress max={Math.max(1,stops.length)} value={done.length}/></section>
   <nav className="fieldTabs"><button className={tab==="active"?"selected":""} onClick={()=>setTab("active")}>Pendientes ({pending.length})</button><button className={tab==="processed"?"selected":""} onClick={()=>setTab("processed")}>Procesadas ({done.length})</button></nav>
   <section className="fieldStops">{(tab==="active"?pending:done).map(s=>{const d=s.dispatches||{},i=Array.isArray(d.installations)?d.installations[0]:d.installations||{};return <article className="fieldStop" key={s.id}><strong>{i.name||"Instalación"}</strong><span>{[i.address,i.commune||i.city].filter(Boolean).join(", ")}</span><small>Guía {d.internal_number||d.guide_number||"—"} · {d.status||"Pendiente"}</small>{tab==="active"?<button disabled={busy} onClick={()=>setDelivery(d)}>Registrar recepción</button>:<span className="fieldDone">Recepción procesada</span>}</article>})}
   {tab==="active"&&pending.length===0&&<p className="fieldEmpty">No quedan entregas pendientes en esta ruta.</p>}
   {tab==="processed"&&done.length===0&&<p className="fieldEmpty">Todavía no hay entregas procesadas.</p>}</section></>:<p className="fieldEmpty">No tienes una ruta asignada. Puedes tomar una ruta disponible.</p>}
   {free.length>0&&<section className="fieldFree"><h2>Rutas disponibles</h2>{free.map(r=><article key={r.id}><div><strong>{r.route_name}</strong><small>{r.planned_date} · {(r.delivery_route_dispatches||[]).filter(s=>!processed.has(s.dispatches?.status)).length} pendientes</small></div><button disabled={busy} onClick={()=>void claim(r.id)}>{busy?"Asignando…":"Tomar ruta"}</button></article>)}</section>}
  </>}
  <button className="fieldRefresh" onClick={()=>void reload()} disabled={loading}>Actualizar rutas</button>
  {delivery&&<DeliveryRegistrationModal dispatch={delivery} close={()=>setDelivery(null)} done={()=>{setDelivery(null);void reload();setTab("active")}}/>}
  <style jsx>{`.fieldDispatch{min-height:100dvh;background:#f5f8fa;color:#153343;padding:16px;max-width:680px;margin:auto;font:inherit;box-sizing:border-box}.fieldHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}.fieldHeader small{font-size:11px;letter-spacing:.07em}.fieldHeader h1{font-size:24px;line-height:1.2;margin:4px 0}.fieldHeader span{font-size:14px}.fieldHeader a{font-size:14px}.fieldProgress,.fieldStop,.fieldFree article{background:white;border:1px solid #d5e2e9;border-radius:14px;padding:16px}.fieldProgress{display:grid;gap:8px}.fieldProgress strong{font-size:18px}.fieldProgress span,.fieldStop span,.fieldStop small,.fieldFree small{font-size:13px;color:#526a76}.fieldProgress progress{width:100%;height:12px;accent-color:#15786e}.fieldTabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}.fieldTabs button{min-height:48px;border:1px solid #a7c2cf;border-radius:10px;background:#fff;color:#153343;font-weight:700}.fieldTabs .selected{background:#0b526f;color:white}.fieldStops{display:grid;gap:10px}.fieldStop{display:grid;gap:8px}.fieldStop strong{font-size:17px}.fieldStop button,.fieldFree button{background:#0b526f;color:white;border:0;border-radius:10px;min-height:50px;padding:10px 16px;font-weight:700}.fieldDone{font-weight:700;color:#147d62!important}.fieldEmpty{padding:20px;background:white;border-radius:12px}.fieldFree{margin-top:24px}.fieldFree h2{font-size:18px}.fieldFree article{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0}.fieldFree article div{display:grid;gap:4px}.fieldSelect{display:grid;gap:6px;margin-bottom:12px}.fieldSelect select{padding:12px;max-width:100%;border-radius:10px}.fieldRefresh{margin:24px 0;padding:12px;border:1px solid #abc5d0;border-radius:10px;background:white}.fieldError{padding:12px;background:#fff0ec;color:#8c2d22;border-radius:10px}@media(max-width:440px){.fieldDispatch{padding:12px}.fieldHeader h1{font-size:21px}.fieldFree article{align-items:stretch;flex-direction:column}.fieldFree button{width:100%}}`}</style>
 </main>;
}
