"use client";
import Link from "next/link";
import {useState} from "react";
import {setAdditionalServiceStatus} from "@/app/additional-services-actions";

type Service={service_code:string;display_name:string;status:"INACTIVO"|"DEMO"|"ACTIVO";access_mode:string;public_entry_enabled:boolean};
export default function AdditionalServicesModule({services}:{services:Service[]}){
 const [saving,setSaving]=useState("");
 const descriptions:Record<string,string>={rendiciones:"Gastos, revisión financiera, saldos y comprobantes.",flota:"Vehículos, QR, uso, seguros, mantenciones y alertas.",cotizaciones:"Cotizaciones comerciales y de proveedores."};
 return <section className="panel"><div className="catalogIntro"><div><h2>Servicios adicionales</h2><p>Admin Total controla qué servicios están disponibles. Activarlos no cambia los permisos de Materiales.</p></div></div>
 <div className="cards">{services.map(s=><article key={s.service_code}><small>Servicio</small><strong style={{fontSize:20}}>{s.display_name}</strong><span>{descriptions[s.service_code]}</span><p><b>Estado: {s.status}</b></p>
 <form action={async(fd)=>{setSaving(s.service_code);try{await setAdditionalServiceStatus(fd)}finally{setSaving("")}}} style={{display:"flex",gap:8,flexWrap:"wrap"}}>
 <input type="hidden" name="service_code" value={s.service_code}/><select name="status" defaultValue={s.status} disabled={saving===s.service_code}><option>INACTIVO</option><option>DEMO</option><option>ACTIVO</option></select><button disabled={saving===s.service_code}>{saving===s.service_code?"Guardando...":"Guardar estado"}</button></form>
 {s.service_code==="rendiciones"&&<p style={{marginTop:10}}><Link href="/rendiciones">Abrir Rendiciones</Link></p>}{s.service_code==="flota"&&s.status!=="INACTIVO"&&<p style={{marginTop:10}}><Link href="/flota">Abrir Flota</Link></p>}</article>)}</div></section>
}
