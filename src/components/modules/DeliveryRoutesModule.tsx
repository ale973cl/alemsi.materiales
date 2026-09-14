"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {confirmRoutePrepared,startDeliveryRoute} from "@/app/route-actions";

export type RouteUser={id:string;full_name?:string|null;email?:string|null;role:string;active:boolean};
export type RouteDispatch={id:string;status:string;internal_number?:string|null;guide_number?:string|null;installations?:any;dispatch_lines?:any[]};
export type DeliveryRoute={id:string;route_name:string;planned_date:string;status:string;preparation_assignee_id:string;delivery_assignee_id:string;created_at:string;preparation_assignee?:any;delivery_assignee?:any;creator?:any;prepared_by_profile?:any;started_by_profile?:any;delivery_route_dispatches?:any[]};

const person=(value:any)=>Array.isArray(value)?value[0]:value;
const inst=(d:RouteDispatch)=>Array.isArray(d.installations)?d.installations[0]:d.installations;
const routeLinks=(r:DeliveryRoute)=>[...(r.delivery_route_dispatches||[])].sort((a,b)=>Number(a.delivery_order)-Number(b.delivery_order));

export default function DeliveryRoutesModule({currentUser,role,statusFilter}:{currentUser:{id:string;full_name?:string|null};role:string;statusFilter?:string[]}){
 const router=useRouter();
 const [routes,setRoutes]=useState<DeliveryRoute[]>([]),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const loadRoutes=async()=>{setLoading(true);try{const r=await fetch("/api/delivery-routes",{cache:"no-store"});const b=await r.json();if(!r.ok)throw new Error(b.error||"No se pudieron cargar las rutas");setRoutes(b.routes||[])}catch(e:any){setMessage(e.message)}finally{setLoading(false)}};
 useEffect(()=>{void loadRoutes()},[]);
 const visible=statusFilter?.length?routes.filter(r=>statusFilter.includes(r.status)):routes;
 return <section style={{margin:"12px 0 16px",border:"1px solid #c8dce8",borderRadius:14,overflow:"hidden",background:"#fff"}}>
  <div style={{padding:"12px 14px",background:"#f5fafb",borderBottom:"1px solid #dce8ef"}}><h3 style={{margin:"0 0 4px"}}>Rutas guardadas y consolidados</h3><small>Las rutas se crean desde la selección de guías de Preparación. Aquí se conserva el responsable, orden, estado y consolidado.</small></div>
  {message&&<div className="notice" style={{margin:12}}>{message}</div>}
  <div style={{display:"grid",gap:10,padding:12}}>{loading?<div className="empty"><b>Cargando rutas…</b></div>:visible.map(r=>{const links=routeLinks(r);const prepPerson=person(r.preparation_assignee),deliveryPerson=person(r.delivery_assignee);return <article key={r.id} style={{border:"1px solid #c8dce8",borderRadius:12,padding:12}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}><div><b style={{fontSize:16}}>{r.route_name}</b><br/><small>{r.planned_date} · {links.length} instalaciones · {r.status}</small><br/><small>Prepara: <b>{prepPerson?.full_name||"—"}</b> · Entrega: <b>{deliveryPerson?.full_name||"—"}</b></small></div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Link className="btn" href={`/rutas/${r.id}/consolidado`} target="_blank">Ver consolidado</Link>{r.status==="Asignada"&&(role!=="Supervisora"||r.preparation_assignee_id===currentUser.id)&&<button onClick={async()=>{try{await confirmRoutePrepared(r.id);await loadRoutes();router.refresh()}catch(e:any){setMessage(e.message)}}}>Marcar preparada</button>}{r.status==="Preparada"&&(role!=="Supervisora"||r.delivery_assignee_id===currentUser.id)&&<button onClick={async()=>{try{await startDeliveryRoute(r.id);await loadRoutes();router.refresh()}catch(e:any){setMessage(e.message)}}}>Iniciar ruta</button>}</div></div><details style={{marginTop:8}}><summary>Ver instalaciones</summary><ol>{links.map((x:any)=><li key={x.id}>{inst(x.dispatches)?.name||"Instalación"}</li>)}</ol></details></article>})}{!loading&&!visible.length&&<div className="empty"><b>Sin rutas en este estado</b><span>Selecciona guías en Preparación para crear una nueva ruta.</span></div>}</div>
 </section>;
}
