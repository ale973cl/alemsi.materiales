import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {documentAlert,mileageAlert,remainingKm,type FleetVehicleSummary} from "@/modules/flota/domain";
import {createVehicle} from "./actions";
import "./flota.css";

const fmtKm=(n:number)=>new Intl.NumberFormat("es-CL").format(n)+" km";
const tone=(level:string)=>level==="critical"?"fleetStatus fleetStatusCritical":level==="warning"?"fleetStatus fleetStatusWarning":"fleetStatus fleetStatusOk";

export default async function FlotaPage(){
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
 const {data:rows,error:vehiclesError}=await supabase.from("fleet_vehicles").select("id,plate,label,status,current_km,next_oil_change_km").eq("active",true).order("plate");
 if(vehiclesError)throw new Error("No fue posible cargar Flota.");
 const vehicles: FleetVehicleSummary[]=(rows??[]).map((v:any)=>({id:v.id,plate:v.plate,label:v.label,status:v.status,currentKm:Number(v.current_km||0),nextOilChangeKm:v.next_oil_change_km==null?null:Number(v.next_oil_change_km)}));
 return <main className="fleetPage">
  <header className="fleetHero">
   <div><p className="fleetEyebrow">ALEMSI · FLOTA{demoMode?" · MODO DEMO":""}</p><h1>Control de Flota</h1><p>Vehículos, documentos, uso y alertas en un solo expediente.</p></div>
   <div className="fleetHeroActions"><Link href="/" className="fleetBtn fleetBtnGhost">Volver</Link>{admin&&<a href="#nuevo-vehiculo" className="fleetBtn fleetBtnPrimary">+ Nuevo vehículo</a>}</div>
  </header>
  {admin&&<details id="nuevo-vehiculo" className="fleetCreate"><summary>Registrar vehículo</summary><form action={createVehicle} className="fleetCreateGrid"><label>Patente<input name="plate" required maxLength={10}/></label><label>Nombre o identificación<input name="label" required maxLength={80}/></label><label>Marca<input name="brand" maxLength={60}/></label><label>Modelo<input name="model" maxLength={60}/></label><label>Año<input name="year" type="number" min="1950" max="2100"/></label><label>Kilometraje actual<input name="current_km" type="number" min="0" required defaultValue="0"/></label><button className="fleetBtn fleetBtnPrimary">Guardar vehículo</button></form></details>}
  <section className="fleetMetrics" aria-label="Resumen de flota">
   <article><span>Vehículos</span><strong>{vehicles.length}</strong></article>
   <article><span>En uso</span><strong>{vehicles.filter(v=>v.status==="En uso").length}</strong></article>
   <article><span>Requieren atención</span><strong>{vehicles.filter(v=>documentAlert(v.insuranceExpiresAt)!=="ok"||mileageAlert(v.currentKm,v.nextOilChangeKm)!=="ok").length}</strong></article>
  </section>
  <section className="fleetQuickActions"><h2>¿Qué necesitas hacer?</h2><div>
   <button disabled>Escanear QR</button><button disabled>Tomar vehículo</button><button disabled>Devolver vehículo</button><button disabled>Cargar combustible</button>
  </div></section>
  <section className="fleetSection">
   <div className="fleetSectionHead"><div><h2>Vehículos</h2><p>Estado actual y próximas atenciones.</p></div></div>
   {vehicles.length===0?<div className="fleetEmpty"><div className="fleetEmptyMark">F</div><h3>Flota lista para configurar</h3><p>No hay vehículos activos registrados. Usa “Nuevo vehículo” para comenzar el expediente de Flota.</p></div>:
   <div className="fleetVehicleGrid">{vehicles.map(v=>{const oil=mileageAlert(v.currentKm,v.nextOilChangeKm),doc=documentAlert(v.insuranceExpiresAt),left=remainingKm(v.currentKm,v.nextOilChangeKm);return <article className="fleetVehicleCard" key={v.id}>
    <div className="fleetVehicleTop"><div><span className="fleetPlate">{v.plate}</span><h3>{v.label}</h3></div><span className={v.status==="Disponible"?"fleetStatus fleetStatusOk":"fleetStatus"}>{v.status}</span></div>
    <div className="fleetCurrent"><span>Kilometraje</span><strong>{fmtKm(v.currentKm)}</strong></div>
    {v.status==="En uso"&&<p><b>{v.currentDriver}</b><br/>Desde {v.takenAt||"—"}</p>}
    <div className="fleetAttention"><span className={tone(oil)}>Aceite · {left==null?"Sin programación":left<=0?"Servicio requerido":`faltan ${fmtKm(left)}`}</span><span className={tone(doc)}>Seguro · {v.insuranceExpiresAt||"Sin vigencia registrada"}</span></div>
    <Link className="fleetCardLink" href={"/flota/"+v.id}>Ver expediente →</Link>
   </article>})}</div>}
  </section>
 </main>;
}
