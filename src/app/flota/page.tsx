import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {documentAlert,mileageAlert,remainingKm,type FleetVehicleSummary} from "@/modules/flota/domain";
import {createVehicle} from "./actions";
import "./flota.css";

const fmtKm=(n:number)=>new Intl.NumberFormat("es-CL").format(n)+" km";
const tone=(level:string)=>level==="critical"?"fleetStatus fleetStatusCritical":level==="warning"?"fleetStatus fleetStatusWarning":"fleetStatus fleetStatusOk";

export default async function FlotaPage({searchParams}:{searchParams:Promise<{notice?:string}>}){
 const notice=(await searchParams).notice;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const {data:profile}=await supabase.from("user_profiles").select("id,full_name,email,role,active").eq("id",user.id).maybeSingle();
 if(!profile?.active)redirect("/");
 const admin=profile.role==="Admin Total";
 const [{data:allowed},{data:service}]=await Promise.all([
  supabase.rpc("has_additional_service_access",{p_service_code:"flota"}),
  supabase.from("additional_services").select("status,display_name").eq("service_code","flota").maybeSingle(),
 ]);
 if(!admin&&!allowed)redirect("/");
 if(!service||service.status==="INACTIVO")redirect("/");
 const demoMode=service.status==="DEMO";
 const {data:rows,error:vehiclesError}=await supabase.from("fleet_vehicles").select("id,plate,label,brand,model,year,status,current_km,next_oil_change_km,cover_photo_path").eq("active",true).order("plate");
 if(vehiclesError)throw new Error("No fue posible cargar Flota.");
 const signed=await Promise.all((rows??[]).map(async(v:any)=>{let photoUrl:string|null=null;if(v.cover_photo_path){const {data}=await supabase.storage.from("fleet-photos").createSignedUrl(v.cover_photo_path,3600);photoUrl=data?.signedUrl??null}return {...v,photoUrl}}));
 const vehicles=signed.map((v:any)=>({id:v.id,plate:v.plate,label:v.label,status:v.status,currentKm:Number(v.current_km||0),nextOilChangeKm:v.next_oil_change_km==null?null:Number(v.next_oil_change_km),brand:v.brand,model:v.model,year:v.year,photoUrl:v.photoUrl}));
 const noticeText=notice==="duplicate"?"La patente ya está registrada. No se creó un duplicado.":notice==="created"?"Vehículo registrado correctamente.":notice==="create-error"?"No fue posible registrar el vehículo. Intenta nuevamente.":null;
 return <main className="fleetPage">
  <header className="fleetHero">
   <div><p className="fleetEyebrow">ALEMSI · FLOTA{demoMode?" · MODO DEMO":""}</p><h1>Control de Flota</h1><p>Vehículos, documentos, uso y alertas en un solo expediente.</p></div>
   <div className="fleetHeroActions"><Link href="/" className="fleetBtn fleetBtnGhost">Volver</Link>{admin&&<a href="#nuevo-vehiculo" className="fleetBtn fleetBtnPrimary">+ Nuevo vehículo</a>}</div>
  </header>
  {noticeText&&<div className={"fleetNotice "+(notice==="create-error"?"fleetNoticeError":"")}>{noticeText}</div>}
  {admin&&<details id="nuevo-vehiculo" className="fleetCreate"><summary>Registrar vehículo</summary><form action={createVehicle} className="fleetCreateGrid"><label>Patente<input name="plate" required maxLength={10}/></label><label>Nombre o identificación<input name="label" required maxLength={80}/></label><label>Marca<input name="brand" maxLength={60}/></label><label>Modelo<input name="model" maxLength={60}/></label><label>Año<input name="year" type="number" min="1950" max="2100"/></label><label>Kilometraje actual<input name="current_km" type="number" min="0" required defaultValue="0"/></label><button className="fleetBtn fleetBtnPrimary">Guardar vehículo</button></form></details>}
  <section className="fleetMetrics" aria-label="Resumen de flota">
   <article><span>Vehículos totales</span><strong>{vehicles.length}</strong></article>
   <article><span>Disponibles</span><strong>{vehicles.filter(v=>v.status==="Disponible").length}</strong></article>
   <article><span>En uso</span><strong>{vehicles.filter(v=>v.status==="En uso").length}</strong></article>
   <article><span>Fuera de servicio</span><strong>{vehicles.filter(v=>v.status==="Fuera de servicio").length}</strong></article>
  </section>
  <section className="fleetSection fleetGarage">
   <div className="fleetSectionHead"><div><h2>Nuestros vehículos</h2><p>Selecciona un vehículo por su fotografía para abrir su expediente.</p></div></div>
   {vehicles.length===0?<div className="fleetEmpty"><div className="fleetEmptyMark">F</div><h3>Flota lista para configurar</h3><p>No hay vehículos activos registrados. Usa “Nuevo vehículo” para comenzar.</p></div>:
   <div className="fleetVehicleGrid">{vehicles.map((v:any)=><Link className="fleetVehicleCard fleetPhotoButton" key={v.id} href={"/flota/"+v.id} aria-label={"Abrir "+v.plate+" "+v.label}>
    <div className="fleetVehiclePhoto">{v.photoUrl?<img src={v.photoUrl} alt={"Vista frontal "+v.plate}/>:<div className="fleetPhotoPending"><span>FOTO FRONTAL</span><small>Se asignará en la primera inspección</small></div>}<span className={"fleetStatus fleetPhotoStatus "+(v.status==="Disponible"?"fleetStatusOk":v.status==="En uso"?"fleetStatusWarning":"fleetStatusCritical")}>{v.status}</span></div>
    <div className="fleetVehicleBody"><strong className="fleetVehiclePlate">{v.plate}</strong><h3>{v.label}</h3><p>{[v.brand,v.model,v.year].filter(Boolean).join(" · ")||"Vehículo ALEMSI"}</p><div className="fleetVehicleMeta"><span>{fmtKm(v.currentKm)}</span><span>Abrir expediente →</span></div></div>
   </Link>)}
   {admin&&<a href="#nuevo-vehiculo" className="fleetAddVehicle"><span>＋</span><strong>Agregar nuevo vehículo</strong><small>Registra un vehículo en la flota</small></a>}</div>}
  </section>
 </main>;
}
