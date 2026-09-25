import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {documentAlert,mileageAlert,remainingKm} from "@/modules/flota/domain";
import {updateVehicle,saveFleetDocument} from "../actions";
import FleetInspectionCamera from "../FleetInspectionCamera";
import {FLEET_DOCUMENT_TEMPLATES} from "@/modules/flota/document-reader";
import FleetDocumentManager from "../FleetDocumentManager";
import "../flota.css";

type View="resumen"|"documentos"|"historial";
const dateTime=(v:string|null)=>v?new Intl.DateTimeFormat("es-CL",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";
const km=(v:number|null)=>v==null?"—":new Intl.NumberFormat("es-CL").format(v)+" km";
export default async function VehiclePage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{vista?:string}>}){
 const {id}=await params;const q=await searchParams;const notice=(q as any).notice;const view=(["resumen","documentos","historial"].includes(q.vista||"")?q.vista:"resumen") as View;
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:p}=await supabase.from("user_profiles").select("full_name,role,active").eq("id",user.id).single();if(!p?.active)redirect("/");
 const {data:allowed}=await supabase.rpc("has_additional_service_access",{p_service_code:"flota"});if(p.role!=="Admin Total"&&!allowed)redirect("/");
 const [{data:v},{data:docs},{data:uses},{data:maintenance},{data:damage},{data:photos}]=await Promise.all([
  supabase.from("fleet_vehicles").select("*").eq("id",id).maybeSingle(),
  supabase.from("fleet_documents").select("*").eq("vehicle_id",id).order("created_at",{ascending:false}),
  supabase.from("fleet_assignments").select("*").eq("vehicle_id",id).order("taken_at",{ascending:false}),
  supabase.from("fleet_maintenance").select("*").eq("vehicle_id",id).order("service_date",{ascending:false}),
  supabase.from("fleet_deterioration_events").select("*").eq("vehicle_id",id).order("created_at",{ascending:false}),
  supabase.from("fleet_photos").select("id,assignment_id,phase,position,storage_path,captured_at").eq("vehicle_id",id).order("captured_at",{ascending:true})
 ]);if(!v)notFound();
 let coverUrl:string|null=null;
 if(v.cover_photo_path){
  if(String(v.cover_photo_path).startsWith("/"))coverUrl=String(v.cover_photo_path);
  else{const {data:cover}=await supabase.storage.from("fleet-photos").createSignedUrl(String(v.cover_photo_path),3600);coverUrl=cover?.signedUrl??null;}
 }
 const currentUse=(uses??[]).find((x:any)=>!x.returned_at);const currentDocs=(docs??[]).filter((x:any)=>x.is_current);
 const documentRows=await Promise.all((docs??[]).map(async(d:any)=>{let file_url:string|null=null;if(d.storage_path){const {data}=await supabase.storage.from("fleet-documents").createSignedUrl(String(d.storage_path),3600);file_url=data?.signedUrl??null;}return {...d,file_url};}));
 const photoRows=await Promise.all((photos??[]).map(async(photo:any)=>{const {data}=await supabase.storage.from("fleet-photos").createSignedUrl(String(photo.storage_path),3600);return {...photo,file_url:data?.signedUrl??null};}));
 const photosByAssignment=new Map<string,any[]>();
 for(const photo of photoRows){const list=photosByAssignment.get(photo.assignment_id)??[];list.push(photo);photosByAssignment.set(photo.assignment_id,list);}
 const photoOrder=["Frontal","Trasera","Lateral izquierdo","Lateral derecho","Tablero","Interior 1","Interior 2"];
 const openDamage=(damage??[]).filter((x:any)=>["Posible deterioro","Deterioro confirmado"].includes(x.status));
 const latestOilDocument=currentDocs.find((d:any)=>d.kind==="MANTENCION"&&d.reader_status==="Confirmado");
 const confirmedNextOilKm=latestOilDocument?.confirmed_data?.next_service_km;
 const parsedNextOilKm=confirmedNextOilKm==null||confirmedNextOilKm===""?null:Number(confirmedNextOilKm);
 const nextOilKm=parsedNextOilKm!=null&&Number.isFinite(parsedNextOilKm)&&parsedNextOilKm>=0
  ?parsedNextOilKm
  :v.next_oil_change_km==null?null:Number(v.next_oil_change_km);
 const oil=mileageAlert(Number(v.current_km),nextOilKm);
 const left=remainingKm(Number(v.current_km),nextOilKm);
 const expiringDocuments=currentDocs.filter((d:any)=>d.expires_at&&documentAlert(d.expires_at)!=="ok");
 const documentKindLabel=(kind:string)=>({REVISION_TECNICA:"Revisión técnica",PERMISO_CIRCULACION:"Permiso de circulación",SOAP:"SOAP",SEGURO_AUTOMOTRIZ:"Seguro automotriz"}[kind]??kind.replaceAll("_"," "));
 return <main className="fleetPage"><header className="fleetHero"><div><p className="fleetEyebrow">ALEMSI · FLOTA</p><h1>{v.plate} · {v.label}</h1><p>{v.brand||""} {v.model||""}{v.year?" · "+v.year:""}</p></div><div className="fleetHeroActions"><Link className="fleetBtn fleetBtnGhost" href="/flota">Volver a Flota</Link></div></header>
 <section className="fleetVehicleProfileHero" aria-label={"Fotografía de "+v.plate}>
  {coverUrl==="/flota/fleet-profiles.webp"?<div className={"fleetProfileSprite fleetProfileSprite"+v.plate} role="img" aria-label={"Fotografía "+v.plate}/>:coverUrl?<img src={coverUrl} alt={"Fotografía de perfil "+v.plate}/>:<div className="fleetPhotoPending"><span>FOTO DEL VEHÍCULO</span><small>Sin fotografía de perfil</small></div>}
  <div className="fleetVehicleProfileInfo"><span className={"fleetStatus "+(v.status==="Disponible"?"fleetStatusOk":v.status==="En uso"?"fleetStatusWarning":"fleetStatusCritical")}>{v.status}</span><strong>{v.plate}</strong><span>{v.label}</span></div>
 </section>
 {notice&&<div className={"fleetNotice "+(notice==="edit-error"||notice==="duplicate"?"fleetNoticeError":"")}>{notice==="updated"?"Datos del vehículo actualizados.":notice==="duplicate"?"La patente ya pertenece a otro vehículo.":"No fue posible actualizar el vehículo."}</div>}
 {p.role==="Admin Total"&&<details className="fleetCreate"><summary>Editar datos del vehículo</summary><form action={updateVehicle} className="fleetCreateGrid"><input type="hidden" name="vehicle_id" value={v.id}/><label>Patente<input name="plate" defaultValue={v.plate} required maxLength={10}/></label><label>Nombre o identificación<input name="label" defaultValue={v.label} required maxLength={80}/></label><label>Tipo de vehículo<input name="vehicle_type" defaultValue={v.vehicle_type||""} maxLength={40}/></label><label>Marca<input name="brand" defaultValue={v.brand||""} maxLength={60}/></label><label>Modelo<input name="model" defaultValue={v.model||""} maxLength={60}/></label><label>N° chasis / VIN<input name="chassis_vin" defaultValue={v.chassis_vin||""} maxLength={40}/></label><label>Año<input name="year" type="number" min="1950" max="2100" defaultValue={v.year||""}/></label><label>Kilometraje actual<input name="current_km" type="number" min="0" defaultValue={v.current_km} required/></label><button className="fleetBtn fleetBtnPrimary">Guardar cambios</button></form></details>}
 <nav className="fleetTabs" aria-label="Expediente del vehículo">{(["resumen","documentos","historial"] as View[]).map(x=><Link key={x} className={"fleetTab "+(view===x?"fleetTabActive":"")} href={"/flota/"+id+"?vista="+x}>{x.toUpperCase()}</Link>)}</nav>
{view==="resumen"&&<><section className="fleetActionPanel fleetActionPanelCamera"><div><span className="fleetStepLabel">ACCIÓN PRINCIPAL</span><h2>{currentUse?"Devolver vehículo":"Tomar vehículo"}</h2><p>{currentUse?"Completa la inspección 7/7 de devolución. Las fotografías quedan asociadas a este uso.":"Toca cada figura para abrir la cámara y completa las 7 fotografías antes de confirmar."}</p></div><FleetInspectionCamera vehicleId={v.id} plate={v.plate} driverName={p.full_name||"Usuario"} currentKm={Number(v.current_km)} assignmentId={currentUse?.id} startKm={currentUse?Number(currentUse.start_km):undefined} mode={currentUse?"return":"take"}/></section><section className="fleetDetailGrid">
  <article className="fleetDetailCard"><h3>Estado actual</h3><strong>{v.status}</strong>{currentUse?<p><b>{currentUse.driver_name}</b><br/>RUT {currentUse.driver_rut}<br/>Desde {dateTime(currentUse.taken_at)}<br/>Inicio {km(currentUse.start_km)}</p>:<p className="fleetMuted">Sin asignación abierta.</p>}</article>
  <article className="fleetDetailCard"><h3>Kilometraje</h3><strong>{km(Number(v.current_km))}</strong><p>Próximo aceite: {km(nextOilKm)}</p><span className={"fleetStatus "+(oil==="critical"?"fleetStatusCritical":oil==="warning"?"fleetStatusWarning":"fleetStatusOk")}>{left==null?"Sin programación":left<=0?"Servicio requerido":km(left)+" restantes"}</span></article>
  <article className="fleetDetailCard"><h3>Atenciones</h3><strong>{openDamage.length}</strong><p>deterioro(s) abiertos</p><details className="fleetAttentionDetails"><summary>{expiringDocuments.length} documento(s) con vencimiento próximo o vencido.</summary>{expiringDocuments.length>0?<div className="fleetAttentionList">{expiringDocuments.map((d:any)=>{const status=documentAlert(d.expires_at);return <Link key={d.id} href={"/flota/"+id+"?vista=documentos#documento-"+d.id} className="fleetAttentionItem"><span><b>{documentKindLabel(d.kind)}</b><small>Vence: {new Intl.DateTimeFormat("es-CL").format(new Date(d.expires_at+"T12:00:00"))}</small></span><span className={"fleetStatus "+(status==="critical"?"fleetStatusCritical":"fleetStatusWarning")}>{status==="critical"?"Vencido":"Próximo"}</span></Link>})}</div>:<p className="fleetMuted">Sin documentos próximos a vencer.</p>}</details></article>
 </section></>}
 {view==="documentos"&&<section><div className="fleetSectionHead"><h2>Expediente documental</h2><p>Lista de documentos del vehículo. Selecciona el nombre para revisar su detalle o abre directamente el archivo original.</p></div><FleetDocumentManager vehicle={{id:v.id,plate:v.plate,chassis_vin:v.chassis_vin||null}} templates={FLEET_DOCUMENT_TEMPLATES} documents={documentRows} saveAction={saveFleetDocument}/></section>}
 {view==="historial"&&<section><h2>Historial cronológico</h2>
 {(uses??[]).map((x:any)=>{const assignmentPhotos=photosByAssignment.get(x.id)??[];const takePhotos=assignmentPhotos.filter((p:any)=>p.phase==="Toma").sort((a:any,b:any)=>photoOrder.indexOf(a.position)-photoOrder.indexOf(b.position));const returnPhotos=assignmentPhotos.filter((p:any)=>p.phase==="Devolución").sort((a:any,b:any)=>photoOrder.indexOf(a.position)-photoOrder.indexOf(b.position));return <article className="fleetUseRecord" key={x.id}><div className="fleetUseRecordHead"><div><small>{dateTime(x.taken_at)}</small><h3>Uso de vehículo</h3><p><b>{x.driver_name}</b> · {km(x.start_km)}{x.returned_at?" → "+km(x.end_km):" · En curso"}</p></div><span className="fleetStatus fleetStatusOk">{assignmentPhotos.length}/14 fotos</span></div>{takePhotos.length>0&&<div className="fleetPhotoPhase"><h4>Toma · {takePhotos.length}/7</h4><div className="fleetHistoryGallery">{takePhotos.map((photo:any)=><a key={photo.id} href={photo.file_url||"#"} target="_blank" rel="noreferrer" className="fleetHistoryPhoto">{photo.file_url?<img src={photo.file_url} alt={"Toma · "+photo.position}/>:<span>Imagen no disponible</span>}<strong>{photo.position}</strong></a>)}</div></div>}{returnPhotos.length>0&&<div className="fleetPhotoPhase"><h4>Devolución · {returnPhotos.length}/7</h4><div className="fleetHistoryGallery">{returnPhotos.map((photo:any)=><a key={photo.id} href={photo.file_url||"#"} target="_blank" rel="noreferrer" className="fleetHistoryPhoto">{photo.file_url?<img src={photo.file_url} alt={"Devolución · "+photo.position}/>:<span>Imagen no disponible</span>}<strong>{photo.position}</strong></a>)}</div></div>}</article>})}
 <div className="fleetTimeline">{[...(maintenance??[]).map((x:any)=>({at:x.service_date,title:x.activity,body:(x.cost!=null?"$ "+Number(x.cost).toLocaleString("es-CL")+" · ":"")+km(x.odometer_km)})),...(damage??[]).map((x:any)=>({at:x.created_at,title:x.status,body:x.review_note||x.ai_summary||"Revisión visual"}))].sort((a,b)=>String(b.at).localeCompare(String(a.at))).map((e,i)=><article key={i}><small>{dateTime(e.at)}</small><h3>{e.title}</h3><p>{e.body}</p></article>)}</div>{!(uses?.length||maintenance?.length||damage?.length)&&<div className="fleetEmpty"><p>Aún no existen eventos para este vehículo.</p></div>}</section>}
 </main>;
}
