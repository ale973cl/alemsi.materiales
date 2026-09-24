import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {documentAlert,mileageAlert,remainingKm} from "@/modules/flota/domain";
import {updateVehicle,saveFleetDocument} from "../actions";
import FleetInspectionCamera from "../FleetInspectionCamera";
import {FLEET_DOCUMENT_TEMPLATES} from "@/modules/flota/document-reader";
import "../flota.css";

type View="resumen"|"documentos"|"historial";
const dateTime=(v:string|null)=>v?new Intl.DateTimeFormat("es-CL",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";
const km=(v:number|null)=>v==null?"—":new Intl.NumberFormat("es-CL").format(v)+" km";
export default async function VehiclePage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{vista?:string}>}){
 const {id}=await params;const q=await searchParams;const notice=(q as any).notice;const view=(["resumen","documentos","historial"].includes(q.vista||"")?q.vista:"resumen") as View;
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:p}=await supabase.from("user_profiles").select("full_name,role,active").eq("id",user.id).single();if(!p?.active)redirect("/");
 const {data:allowed}=await supabase.rpc("has_additional_service_access",{p_service_code:"flota"});if(p.role!=="Admin Total"&&!allowed)redirect("/");
 const [{data:v,error:vehicleError},{data:docs,error:docsError},{data:uses,error:usesError},{data:maintenance,error:maintenanceError},{data:damage,error:damageError},{data:photos,error:photosError}]=await Promise.all([
  supabase.from("fleet_vehicles").select("*").eq("id",id).maybeSingle(),
  supabase.from("fleet_documents").select("*").eq("vehicle_id",id).order("created_at",{ascending:false}),
  supabase.from("fleet_assignments").select("*").eq("vehicle_id",id).order("taken_at",{ascending:false}),
  supabase.from("fleet_maintenance").select("*").eq("vehicle_id",id).order("service_date",{ascending:false}),
  supabase.from("fleet_deterioration_events").select("*").eq("vehicle_id",id).order("created_at",{ascending:false}),
  supabase.from("fleet_photos").select("id,assignment_id,phase,position,storage_path,captured_at").eq("vehicle_id",id).order("captured_at",{ascending:true})
 ]);
 if(vehicleError||docsError||usesError||maintenanceError||damageError||photosError)throw new Error("No fue posible cargar el expediente completo de Flota.");
 if(!v)notFound();
 const signedPhotos=await Promise.all((photos??[]).map(async(photo:any)=>{
  const {data,error}=await supabase.storage.from("fleet-photos").createSignedUrl(String(photo.storage_path),3600);
  return {...photo,url:error?null:data?.signedUrl??null};
 }));
 let coverUrl:string|null=null;
 if(v.cover_photo_path){
  if(String(v.cover_photo_path).startsWith("/"))coverUrl=String(v.cover_photo_path);
  else{const {data:cover}=await supabase.storage.from("fleet-photos").createSignedUrl(String(v.cover_photo_path),3600);coverUrl=cover?.signedUrl??null;}
 }
 const currentUse=(uses??[]).find((x:any)=>!x.returned_at);const currentDocs=(docs??[]).filter((x:any)=>x.is_current);const openDamage=(damage??[]).filter((x:any)=>["Posible deterioro","Deterioro confirmado"].includes(x.status));
 const oil=mileageAlert(Number(v.current_km),v.next_oil_change_km==null?null:Number(v.next_oil_change_km));const left=remainingKm(Number(v.current_km),v.next_oil_change_km==null?null:Number(v.next_oil_change_km));
 const noticeLabels:Record<string,string>={updated:"Datos del vehículo actualizados.",duplicate:"La patente ya pertenece a otro vehículo.","edit-error":"No fue posible actualizar el vehículo.",taken:"Toma e inspección 7/7 guardadas correctamente.",returned:"Devolución e inspección 7/7 guardadas correctamente.","already-in-use":"El vehículo ya fue tomado por otra sesión. Se recargó su estado actual.","already-returned":"Esta devolución ya estaba registrada. Se recargó el historial.","assignment-missing":"No se encontró la asignación solicitada."};
 return <main className="fleetPage"><header className="fleetHero"><div><p className="fleetEyebrow">ALEMSI · FLOTA</p><h1>{v.plate} · {v.label}</h1><p>{v.brand||""} {v.model||""}{v.year?" · "+v.year:""}</p></div><div className="fleetHeroActions"><Link className="fleetBtn fleetBtnGhost" href="/flota">Volver a Flota</Link></div></header>
 <section className="fleetVehicleProfileHero" aria-label={"Fotografía de "+v.plate}>
  {coverUrl==="/flota/fleet-profiles.webp"?<div className={"fleetProfileSprite fleetProfileSprite"+v.plate} role="img" aria-label={"Fotografía "+v.plate}/>:coverUrl?<img src={coverUrl} alt={"Fotografía de perfil "+v.plate}/>:<div className="fleetPhotoPending"><span>FOTO DEL VEHÍCULO</span><small>Sin fotografía de perfil</small></div>}
  <div className="fleetVehicleProfileInfo"><span className={"fleetStatus "+(v.status==="Disponible"?"fleetStatusOk":v.status==="En uso"?"fleetStatusWarning":"fleetStatusCritical")}>{v.status}</span><strong>{v.plate}</strong><span>{v.label}</span></div>
 </section>
 {notice&&noticeLabels[notice]&&<div className={"fleetNotice "+(["edit-error","duplicate","assignment-missing"].includes(notice)?"fleetNoticeError":"")}>{noticeLabels[notice]}</div>}
 {p.role==="Admin Total"&&<details className="fleetCreate"><summary>Editar datos del vehículo</summary><form action={updateVehicle} className="fleetCreateGrid"><input type="hidden" name="vehicle_id" value={v.id}/><label>Patente<input name="plate" defaultValue={v.plate} required maxLength={10}/></label><label>Nombre o identificación<input name="label" defaultValue={v.label} required maxLength={80}/></label><label>Tipo de vehículo<input name="vehicle_type" defaultValue={v.vehicle_type||""} maxLength={40}/></label><label>Marca<input name="brand" defaultValue={v.brand||""} maxLength={60}/></label><label>Modelo<input name="model" defaultValue={v.model||""} maxLength={60}/></label><label>N° chasis / VIN<input name="chassis_vin" defaultValue={v.chassis_vin||""} maxLength={40}/></label><label>Año<input name="year" type="number" min="1950" max="2100" defaultValue={v.year||""}/></label><label>Kilometraje actual<input name="current_km" type="number" min="0" defaultValue={v.current_km} required/></label><button className="fleetBtn fleetBtnPrimary">Guardar cambios</button></form></details>}
 <nav className="fleetTabs" aria-label="Expediente del vehículo">{(["resumen","documentos","historial"] as View[]).map(x=><Link key={x} className={"fleetTab "+(view===x?"fleetTabActive":"")} href={"/flota/"+id+"?vista="+x}>{x.toUpperCase()}</Link>)}</nav>
{view==="resumen"&&<><section className="fleetActionPanel fleetActionPanelCamera"><div><span className="fleetStepLabel">ACCIÓN PRINCIPAL</span><h2>{currentUse?"Devolver vehículo":"Tomar vehículo"}</h2><p>{currentUse?"Completa la inspección 7/7 de devolución. Las fotografías quedan asociadas a este uso.":"Toca cada figura para abrir la cámara y completa las 7 fotografías antes de confirmar."}</p></div><FleetInspectionCamera vehicleId={v.id} plate={v.plate} driverName={p.full_name||"Usuario"} currentKm={Number(v.current_km)} assignmentId={currentUse?.id} startKm={currentUse?Number(currentUse.start_km):undefined} mode={currentUse?"return":"take"}/></section><section className="fleetDetailGrid">
  <article className="fleetDetailCard"><h3>Estado actual</h3><strong>{v.status}</strong>{currentUse?<p><b>{currentUse.driver_name}</b><br/>RUT {currentUse.driver_rut}<br/>Desde {dateTime(currentUse.taken_at)}<br/>Inicio {km(currentUse.start_km)}</p>:<p className="fleetMuted">Sin asignación abierta.</p>}</article>
  <article className="fleetDetailCard"><h3>Kilometraje</h3><strong>{km(Number(v.current_km))}</strong><p>Próximo aceite: {km(v.next_oil_change_km)}</p><span className={"fleetStatus "+(oil==="critical"?"fleetStatusCritical":oil==="warning"?"fleetStatusWarning":"fleetStatusOk")}>{left==null?"Sin programación":left<=0?"Servicio requerido":km(left)+" restantes"}</span></article>
  <article className="fleetDetailCard"><h3>Atenciones</h3><strong>{openDamage.length}</strong><p>deterioro(s) abiertos</p><p>{currentDocs.filter((d:any)=>documentAlert(d.expires_at)!=="ok").length} documento(s) próximos a vencer o sin vigencia.</p></article>
 </section></>}
 {view==="documentos"&&<section><div className="fleetSectionHead"><h2>Expediente documental</h2><p>Acceso rápido, vigencias y renovaciones. El lector dirigido usa plantillas específicas y los datos siempre se confirman antes de operar.</p></div>
 <details className="fleetCreate" open={currentDocs.length===0}><summary>+ Agregar / renovar documento</summary><form action={saveFleetDocument} className="fleetCreateGrid"><input type="hidden" name="vehicle_id" value={v.id}/>
 <label>Tipo<select name="kind" required defaultValue=""><option value="" disabled>Seleccionar</option>{FLEET_DOCUMENT_TEMPLATES.map(t=><option key={t.kind} value={t.kind}>{t.kind.replaceAll("_"," ")}</option>)}</select></label>
 <label>Archivo para lectura<input name="document_file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/></label>
 <div className="fleetReaderHint"><strong>LECTOR DIRIGIDO</strong><span>Preparado para identificar tipo, patente/VIN, fechas y campos prioritarios. La conexión al motor visual queda pendiente; por ahora confirma los datos leídos antes de guardar.</span></div>
 <label>Patente del documento<input name="document_plate" defaultValue={v.plate}/></label><label>VIN / Chasis<input name="document_vin" defaultValue={v.chassis_vin||""}/></label>
 <label>Vigente desde<input name="valid_from" type="date"/></label><label>Vence<input name="expires_at" type="date"/></label>
 <label>Aseguradora<input name="insurer"/></label><label>N° póliza<input name="policy_number"/></label><label>Teléfono asistencia<input name="assistance_phone"/></label>
 <label className="fleetWide">Servicios / coberturas<input name="services" placeholder="Grúa, auto de reemplazo, asistencia legal..."/></label>
 <label className="fleetWide">Instrucciones<textarea name="instructions" placeholder="Indicaciones rápidas para usar el seguro o asistencia"/></label>
 <button className="fleetBtn fleetBtnPrimary">Confirmar y guardar período</button></form></details>
 <h2>Documentos vigentes</h2>{currentDocs.length===0?<div className="fleetEmpty"><h3>Sin documentos registrados</h3><p>Agrega el primer documento. Las renovaciones conservarán las versiones anteriores.</p></div>:currentDocs.map((d:any)=><article className="fleetDocRow" key={d.id}><div><strong>{String(d.kind).replaceAll("_"," ")}</strong><small>Versión {d.version}{d.policy_number?" · "+d.policy_number:""}</small></div><span>{d.valid_from||"—"} → {d.expires_at||"Sin vencimiento"}</span><span className={"fleetStatus "+(documentAlert(d.expires_at)==="critical"?"fleetStatusCritical":documentAlert(d.expires_at)==="warning"?"fleetStatusWarning":"fleetStatusOk")}>{documentAlert(d.expires_at)==="ok"?"Vigente":"Requiere atención"}</span><div className="fleetDocServices">{(d.services??[]).slice(0,6).map((x:string)=><span key={x}>✓ {x}</span>)}</div></article>)}</section>}
 {view==="historial"&&<section><h2>Historial cronológico</h2>
  <div className="fleetAssignmentHistory">{(uses??[]).map((use:any)=>{const evidence=signedPhotos.filter((photo:any)=>photo.assignment_id===use.id);return <article className="fleetAssignmentCard" key={use.id}><header><div><small>{dateTime(use.taken_at)}</small><h3>{use.returned_at?"Uso terminado":"Uso en curso"}</h3><p><b>{use.driver_name}</b> · RUT {use.driver_rut}<br/>{km(use.start_km)}{use.end_km==null?"":" → "+km(use.end_km)}{use.end_km==null?"":" · Distancia "+km(Number(use.end_km)-Number(use.start_km))}</p></div><span className={"fleetStatus "+(use.returned_at?"fleetStatusOk":"fleetStatusWarning")}>{use.returned_at?"Devuelto":"En uso"}</span></header>
   {(["Toma","Devolución"] as const).map(phase=>{const phasePhotos=evidence.filter((photo:any)=>photo.phase===phase);if(!phasePhotos.length)return null;return <details className="fleetEvidence" key={phase}><summary>{phase} · {phasePhotos.length}/7 fotografías · {dateTime(phasePhotos[0]?.captured_at)}</summary><div className="fleetEvidenceGrid">{phasePhotos.map((photo:any)=><figure key={photo.id}>{photo.url?<a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={phase+" · "+photo.position}/></a>:<div className="fleetPhotoUnavailable">Archivo no disponible</div>}<figcaption><strong>{photo.position}</strong><span>{dateTime(photo.captured_at)}</span></figcaption></figure>)}</div></details>})}
   {!evidence.length&&<p className="fleetMuted">Este uso histórico no tiene fotografías registradas.</p>}</article>})}</div>
  <div className="fleetTimeline">{[...(maintenance??[]).map((x:any)=>({at:x.service_date,title:x.activity,body:(x.cost!=null?"$ "+Number(x.cost).toLocaleString("es-CL")+" · ":"")+km(x.odometer_km)})),...(damage??[]).map((x:any)=>({at:x.created_at,title:x.status,body:x.review_note||x.ai_summary||"Revisión visual"}))].sort((a,b)=>String(b.at).localeCompare(String(a.at))).map((e,i)=><article key={i}><small>{dateTime(e.at)}</small><h3>{e.title}</h3><p>{e.body}</p></article>)}</div>{!(uses?.length||maintenance?.length||damage?.length)&&<div className="fleetEmpty"><p>Aún no existen eventos para este vehículo.</p></div>}</section>}
 </main>;
}
