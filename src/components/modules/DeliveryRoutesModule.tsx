"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createDeliveryRoute,confirmRoutePrepared,startDeliveryRoute} from "@/app/route-actions";

export type RouteUser={id:string;full_name?:string|null;email?:string|null;role:string;active:boolean};
export type RouteDispatch={id:string;status:string;internal_number?:string|null;guide_number?:string|null;installations?:any;dispatch_lines?:any[]};
export type DeliveryRoute={id:string;route_name:string;planned_date:string;status:string;preparation_assignee_id:string;delivery_assignee_id:string;created_at:string;preparation_assignee?:any;delivery_assignee?:any;creator?:any;prepared_by_profile?:any;started_by_profile?:any;delivery_route_dispatches?:any[]};

const person=(value:any)=>Array.isArray(value)?value[0]:value;
const inst=(d:RouteDispatch)=>Array.isArray(d.installations)?d.installations[0]:d.installations;
const routeLinks=(r:DeliveryRoute)=>[...(r.delivery_route_dispatches||[])].sort((a,b)=>Number(a.delivery_order)-Number(b.delivery_order));

export default function DeliveryRoutesModule({dispatches,users,currentUser,role}:{dispatches:RouteDispatch[];users:RouteUser[];currentUser:{id:string;full_name?:string|null};role:string}){
 const router=useRouter();
 const [routes,setRoutes]=useState<DeliveryRoute[]>([]),[loading,setLoading]=useState(true);
 const [selected,setSelected]=useState<string[]>([]);
 const [prep,setPrep]=useState(currentUser.id);
 const [delivery,setDelivery]=useState(currentUser.id);
 const [plannedDate,setPlannedDate]=useState(new Date().toISOString().slice(0,10));
 const [routeName,setRouteName]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const loadRoutes=async()=>{setLoading(true);try{const r=await fetch("/api/delivery-routes",{cache:"no-store"});const b=await r.json();if(!r.ok)throw new Error(b.error||"No se pudieron cargar las rutas");setRoutes(b.routes||[])}catch(e:any){setMessage(e.message)}finally{setLoading(false)}};
 useEffect(()=>{void loadRoutes()},[]);
 const activeUsers=users.filter(u=>u.active&&["Admin Total","Gerencia","Admin","Bodega","Supervisora"].includes(u.role));
 const assigned=new Set(routes.flatMap(r=>routeLinks(r).map(x=>String(x.dispatch_id))));
 const eligible=useMemo(()=>dispatches.filter(d=>["En preparación","Listo para despacho"].includes(d.status)&&!assigned.has(d.id)),[dispatches,routes]);
 const canAssign=["Admin Total","Gerencia","Admin","Bodega"].includes(role);
 const toggle=(id:string)=>setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const create=async()=>{if(!selected.length){setMessage("Selecciona al menos una instalación.");return}setBusy(true);setMessage("");try{const result=await createDeliveryRoute({routeName,plannedDate,preparationAssigneeId:prep,deliveryAssigneeId:delivery,dispatchIds:selected});setMessage(`Ruta creada: ${result.name}`);setSelected([]);setRouteName("");await loadRoutes();router.refresh()}catch(e:any){setMessage(e?.message||"No se pudo crear la ruta")}finally{setBusy(false)}};
 return <section style={{marginBottom:18,border:"1px solid #c8dce8",borderRadius:14,overflow:"hidden",background:"#fff"}}>
  <div style={{padding:"14px 16px",background:"#f5fafb",borderBottom:"1px solid #dce8ef"}}><h3 style={{margin:"0 0 4px"}}>Rutas de entrega y consolidados</h3><small>La ruta conserva responsables, instalaciones, orden y consolidado. El consolidado puede abrirse nuevamente en cualquier momento.</small></div>
  {message&&<div className="notice" style={{margin:12}}>{message}</div>}
  {canAssign&&<div style={{padding:14,borderBottom:"1px solid #dce8ef"}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,marginBottom:12}}><label><b>Quién prepara</b><select value={prep} onChange={e=>setPrep(e.target.value)}>{activeUsers.map(u=><option key={u.id} value={u.id}>{u.full_name||u.email||u.role}</option>)}</select></label><label><b>Quién entrega</b><select value={delivery} onChange={e=>setDelivery(e.target.value)}>{activeUsers.map(u=><option key={u.id} value={u.id}>{u.full_name||u.email||u.role}</option>)}</select></label><label><b>Fecha prevista</b><input type="date" value={plannedDate} onChange={e=>setPlannedDate(e.target.value)}/></label><label><b>Referencia opcional</b><input value={routeName} onChange={e=>setRouteName(e.target.value)} placeholder="Ej.: Ruta Costa"/></label></div><div style={{display:"grid",gap:6,maxHeight:250,overflow:"auto",border:"1px solid #dce8ef",borderRadius:10,padding:8}}>{eligible.map(d=>{const i=inst(d);return <label key={d.id} style={{display:"grid",gridTemplateColumns:"28px 1fr",gap:8,alignItems:"center",padding:7,borderBottom:"1px solid #eef3f6"}}><input type="checkbox" checked={selected.includes(d.id)} onChange={()=>toggle(d.id)}/><span><b>{i?.name||"Instalación"}</b><br/><small>{d.internal_number||d.guide_number||"Guía interna"} · {i?.city||i?.commune||i?.region||"Ubicación pendiente"}</small></span></label>})}{!eligible.length&&<small>No hay guías de preparación sin ruta asignada.</small>}</div><div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><button disabled={busy||!selected.length} onClick={create}>{busy?"Creando ruta…":`Crear ruta (${selected.length})`}</button></div></div>}
  <div style={{display:"grid",gap:10,padding:14}}>{loading?<div className="empty"><b>Cargando rutas…</b></div>:routes.map(r=>{const links=routeLinks(r);const prepPerson=person(r.preparation_assignee),deliveryPerson=person(r.delivery_assignee);return <article key={r.id} style={{border:"1px solid #c8dce8",borderRadius:12,padding:12}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}><div><b style={{fontSize:16}}>{r.route_name}</b><br/><small>{r.planned_date} · {links.length} instalaciones · {r.status}</small><br/><small>Prepara: <b>{prepPerson?.full_name||"—"}</b> · Entrega: <b>{deliveryPerson?.full_name||"—"}</b></small></div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Link className="btn" href={`/rutas/${r.id}/consolidado`} target="_blank">Ver consolidado</Link>{r.status==="Asignada"&&(role!=="Supervisora"||r.preparation_assignee_id===currentUser.id)&&<button onClick={async()=>{try{await confirmRoutePrepared(r.id);await loadRoutes();router.refresh()}catch(e:any){setMessage(e.message)}}}>Marcar preparada</button>}{r.status==="Preparada"&&(role!=="Supervisora"||r.delivery_assignee_id===currentUser.id)&&<button onClick={async()=>{try{await startDeliveryRoute(r.id);await loadRoutes();router.refresh()}catch(e:any){setMessage(e.message)}}}>Iniciar ruta</button>}</div></div><details style={{marginTop:8}}><summary>Ver instalaciones</summary><ol>{links.map((x:any)=><li key={x.id}>{inst(x.dispatches)?.name||"Instalación"}</li>)}</ol></details></article>})}{!loading&&!routes.length&&<div className="empty"><b>Aún no hay rutas guardadas</b><span>Al crear una ruta, el consolidado quedará asociado permanentemente.</span></div>}</div>
 </section>;
}
