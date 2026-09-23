import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {documentAlert,mileageAlert,remainingKm,type FleetVehicleSummary} from "@/modules/flota/domain";
import "./flota.css";

const demo: FleetVehicleSummary[]=[];
const fmtKm=(n:number)=>new Intl.NumberFormat("es-CL").format(n)+" km";
const tone=(level:string)=>level==="critical"?"fleetStatus fleetStatusCritical":level==="warning"?"fleetStatus fleetStatusWarning":"fleetStatus fleetStatusOk";

export default async function FlotaPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const {data:profile}=await supabase.from("user_profiles").select("id,full_name,email,role,active").eq("id",user.id).maybeSingle();
 if(!profile?.active)redirect("/");
 // Fase base: no se consulta ni modifica Materiales/Bodega. Vehículos se conectarán tras aprobar el esquema Flota.
 const vehicles=demo;
 return <main className="fleetPage">
  <header className="fleetHero">
   <div><p className="fleetEyebrow">ALEMSI · FLOTA</p><h1>Control de Flota</h1><p>Vehículos, documentos, uso y alertas en un solo expediente.</p></div>
   <div className="fleetHeroActions"><Link href="/" className="fleetBtn fleetBtnGhost">Volver</Link><button className="fleetBtn fleetBtnPrimary" disabled>+ Nuevo vehículo</button></div>
  </header>
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
   {vehicles.length===0?<div className="fleetEmpty"><div className="fleetEmptyMark">F</div><h3>Flota lista para configurar</h3><p>La interfaz base está separada de Materiales y Bodega. El alta de vehículos se habilitará al conectar el esquema propio de Flota.</p></div>:
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
