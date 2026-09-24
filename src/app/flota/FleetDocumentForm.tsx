"use client";
import {useState} from "react";
import {useFormStatus} from "react-dom";
import {saveFleetDocument} from "./actions";
import {FLEET_DOCUMENT_TEMPLATES} from "@/modules/flota/document-reader";

type Props={vehicleId:string;plate:string;vin:string};
type Fields={kind:string;document_plate:string;document_vin:string;valid_from:string;expires_at:string;insurer:string;policy_number:string;assistance_phone:string;services:string;instructions:string};
export default function FleetDocumentForm({vehicleId,plate,vin}:Props){
 const [fields,setFields]=useState<Fields>({kind:"",document_plate:plate,document_vin:vin,valid_from:"",expires_at:"",insurer:"",policy_number:"",assistance_phone:"",services:"",instructions:""});
 const [reading,setReading]=useState(false),[message,setMessage]=useState("Selecciona el original y pulsa Leer documento."),[file,setFile]=useState<File|null>(null);
 const set=(key:keyof Fields,value:string)=>setFields(previous=>({...previous,[key]:value}));
 async function read(){if(!file)return setMessage("Selecciona primero un PDF o una imagen.");setReading(true);setMessage("Leyendo el documento…");try{const form=new FormData();form.set("file",file);form.set("vehicle_id",vehicleId);const response=await fetch("/api/flota/read-document",{method:"POST",body:form});const payload=await response.json();if(!response.ok)throw new Error(payload?.error||"No se pudo leer el documento.");const d=payload.data??{};setFields(previous=>({...previous,kind:d.kind||previous.kind,document_plate:d.document_plate||previous.document_plate,document_vin:d.document_vin||previous.document_vin,valid_from:d.valid_from||previous.valid_from,expires_at:d.expires_at||previous.expires_at,insurer:d.insurer||previous.insurer,policy_number:d.policy_number||previous.policy_number,assistance_phone:d.assistance_phone||previous.assistance_phone,services:Array.isArray(d.services)?d.services.join(", "):previous.services,instructions:d.instructions||previous.instructions}));setMessage(d.requires_review?"Lectura terminada con datos para revisar. Confirma o corrige antes de guardar.":"Lectura terminada. Confirma los datos antes de guardar.")}catch(error){setMessage(error instanceof Error?error.message:"No se pudo leer; completa manualmente.")}finally{setReading(false)}}
 return <form action={saveFleetDocument} className="fleetCreateGrid"><input type="hidden" name="vehicle_id" value={vehicleId}/>
  <label>Tipo<select name="kind" required value={fields.kind} onChange={e=>set("kind",e.target.value)}><option value="" disabled>Seleccionar</option>{FLEET_DOCUMENT_TEMPLATES.map(t=><option key={t.kind} value={t.kind}>{t.kind.replaceAll("_"," ")}</option>)}</select></label>
  <label>Archivo original<input name="document_file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>{setFile(e.target.files?.[0]??null);setMessage("Archivo seleccionado. Pulsa Leer documento para completar la propuesta.")}}/></label>
  <button type="button" className="fleetBtn fleetBtnGhost" disabled={!file||reading} onClick={read}>{reading?"Leyendo…":"Leer documento"}</button>
  <div className="fleetReaderHint"><strong>LECTOR DIRIGIDO</strong><span>{message}</span></div>
  <label>Patente del documento<input name="document_plate" value={fields.document_plate} onChange={e=>set("document_plate",e.target.value)}/></label><label>VIN / Chasis<input name="document_vin" value={fields.document_vin} onChange={e=>set("document_vin",e.target.value)}/></label>
  <label>Vigente desde<input name="valid_from" type="date" value={fields.valid_from} onChange={e=>set("valid_from",e.target.value)}/></label><label>Vence<input name="expires_at" type="date" value={fields.expires_at} onChange={e=>set("expires_at",e.target.value)}/></label>
  <label>Aseguradora<input name="insurer" value={fields.insurer} onChange={e=>set("insurer",e.target.value)}/></label><label>N° póliza<input name="policy_number" value={fields.policy_number} onChange={e=>set("policy_number",e.target.value)}/></label><label>Teléfono asistencia<input name="assistance_phone" value={fields.assistance_phone} onChange={e=>set("assistance_phone",e.target.value)}/></label>
  <label className="fleetWide">Servicios / coberturas<input name="services" value={fields.services} onChange={e=>set("services",e.target.value)} placeholder="Grúa, auto de reemplazo, asistencia legal..."/></label>
  <label className="fleetWide">Instrucciones<textarea name="instructions" value={fields.instructions} onChange={e=>set("instructions",e.target.value)} placeholder="Indicaciones rápidas para usar el seguro o asistencia"/></label>
  <DocumentSubmit reading={reading}/>
 </form>;
}
function DocumentSubmit({reading}:{reading:boolean}){const {pending}=useFormStatus();return <button className="fleetBtn fleetBtnPrimary" disabled={pending||reading}>{pending?"Subiendo original y registrando…":"Confirmar y guardar período"}</button>}
