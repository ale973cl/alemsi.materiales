import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {documentAlert,mileageAlert,remainingKm} from "@/modules/flota/domain";
import "../flota.css";

type View="resumen"|"documentos"|"historial";
const dateTime=(v:string|null)=>v?new Intl.DateTimeFormat("es-CL",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";
const km=(v:number|null)=>v==null?"—":new Intl.NumberFormat("es-CL").format(v)+" km";
export default async function VehiclePage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{vista?:string}>}){
 const {id}=await params;const q=await searchParams;const view=(["resumen","documentos","historial"].includes(q.vista||"")?q.vista:"resumen") as View;
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:p}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();if(!p?.active)redirect("/");
 const {data:allowed}=await supabase.rpc("has_additional_service_access",{p_service_code:"flota"});if(p.role!=="Admin Total"&&!allowed)redirect("/");
 const [{data:v},{data:docs},{data:uses},{data:maintenance},{data:damage}]=await Promise.all([
  supabase.from("fleet_vehicles").select("*").eq("id",id).maybeSingle(),
  supabase.from("fleet_documents").select("*").eq("vehicle_id",id).order("created_at",{ascending:false}),
  supabase.from("fleet_assignments").select("*").eq("vehicle_id",id).order("taken_at",{ascending:false}),
  supabase.from("fleet_maintenance").select("*").eq("vehicle_id",id).order("service_date",{ascending:false}),
  supabase.from("fleet_deterioration_events").select("*").eq("vehicle_id",id).order("created_at",{ascending:false})
 ]);if(!v)notFound();
 const currentUse=(uses??[]).find((x:any)=>!x.returned_at);const currentDocs=(docs??[]).filter((x:any)=>x.is_current);const openDamage=(damage??[]).filter((x:any)=>["Posible deterioro","Deterioro confirmado"].includes(x.status));
 const oil=mileageAlert(Number(v.current_km),v.next_oil_change_km==null?null:Number(v.next_oil_change_km));const left=remainingKm(Number(v.current_km),v.next_oil_change_km==null?null:Number(v.next_oil_change_km));
 return <main className="fleetPage"><header className="fleetHero"><div><p className="fleetEyebrow">ALEMSI · FLOTA</p><h1>{v.plate} · {v.label}</h1><p>{v.brand||""} {v.model||""}{v.year?" · "+v.year:""}</p></div><div className="fleetHeroActions"><Link className="fleetBtn fleetBtnGhost" href="/flota">Volver a Flota</Link></div></header>
 <nav className="fleetTabs" aria-label="Expediente del vehículo">{(["resumen","documentos","historial"] as View[]).map(x=><Link key={x} className={"fleetTab "+(view===x?"fleetTabActive":"")} href={"/flota/"+id+"?vista="+x}>{x.toUpperCase()}</Link>)}</nav>
 {view==="resumen"&&<section className="fleetDetailGrid">
  <article className="fleetDetailCard"><h3>Estado actual</h3><strong>{v.status}</strong>{currentUse?<p><b>{currentUse.driver_name}</b><br/>RUT {currentUse.driver_rut}<br/>Desde {dateTime(currentUse.taken_at)}<br/>Inicio {km(currentUse.start_km)}</p>:<p className="fleetMuted">Sin asignación abierta.</p>}</article>
  <article className="fleetDetailCard"><h3>Kilometraje</h3><strong>{km(Number(v.current_km))}</strong><p>Próximo aceite: {km(v.next_oil_change_km)}</p><span className={"fleetStatus "+(oil==="critical"?"fleetStatusCritical":oil==="warning"?"fleetStatusWarning":"fleetStatusOk")}>{left==null?"Sin programación":left<=0?"Servicio requerido":km(left)+" restantes"}</span></article>
  <article className="fleetDetailCard"><h3>Atenciones</h3><strong>{openDamage.length}</strong><p>deterioro(s) abiertos</p><p>{currentDocs.filter((d:any)=>documentAlert(d.expires_at)!=="ok").length} documento(s) próximos a vencer o sin vigencia.</p></article>
 </section>}
 {view==="documentos"&&<section><h2>Documentos vigentes</h2>{currentDocs.length===0?<div className="fleetEmpty"><h3>Sin documentos registrados</h3><p>Los documentos se agregarán sin reemplazar versiones anteriores.</p></div>:currentDocs.map((d:any)=><article className="fleetDocRow" key={d.id}><strong>{d.kind}</strong><span>Vence: {d.expires_at||"Sin fecha"}</span><span className={"fleetStatus "+(documentAlert(d.expires_at)==="critical"?"fleetStatusCritical":documentAlert(d.expires_at)==="warning"?"fleetStatusWarning":"fleetStatusOk")}>{documentAlert(d.expires_at)==="ok"?"Vigente":"Requiere atención"}</span></article>)}</section>}
 {view==="historial"&&<section><h2>Historial cronológico</h2><div className="fleetTimeline">{[...(uses??[]).map((x:any)=>({at:x.taken_at,title:"Uso de vehículo",body:x.driver_name+" · "+km(x.start_km)+(x.returned_at?" → "+km(x.end_km):" · En curso")})),...(maintenance??[]).map((x:any)=>({at:x.service_date,title:x.activity,body:(x.cost!=null?"$ "+Number(x.cost).toLocaleString("es-CL")+" · ":"")+km(x.odometer_km)})),...(damage??[]).map((x:any)=>({at:x.created_at,title:x.status,body:x.review_note||x.ai_summary||"Revisión visual"}))].sort((a,b)=>String(b.at).localeCompare(String(a.at))).map((e,i)=><article key={i}><small>{dateTime(e.at)}</small><h3>{e.title}</h3><p>{e.body}</p></article>)}</div>{!(uses?.length||maintenance?.length||damage?.length)&&<div className="fleetEmpty"><p>Aún no existen eventos para este vehículo.</p></div>}</section>}
 </main>;
}
