"use client";

import {useRef,useState} from "react";
import {confirmInstallationCsvRows,previewInstallationCsvRows} from "@/app/installation-import-actions";

type Row={
 client?:string;rut?:string;contract?:string;installation?:string;region?:string;city?:string;commune?:string;address?:string;
 surface_m2?:string;collaborator_count?:string;delivery_contact_name?:string;delivery_email?:string;general_email?:string;delivery_phone?:string;phone?:string;
 delivery_notes?:string;postal_code?:string;latitude?:string;longitude?:string;access_hours?:string;technical_contact_name?:string;
 technical_contact_email?:string;technical_contact_phone?:string;observations?:string
};

const parse=(line:string,d:string)=>{const a:string[]=[];let v="",q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===d&&!q){a.push(v.trim());v="";}else v+=c;}a.push(v.trim());return a;};
const norm=(v:string)=>String(v||"").trim().toLocaleLowerCase("es-CL").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/_/g," ").replace(/\s+/g," ");

export default function InstallationCsvImportPanel(){
 const ref=useRef<HTMLInputElement|null>(null);
 const [rows,setRows]=useState<Row[]>([]),[preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[fileName,setFileName]=useState("");
 const reset=()=>{setRows([]);setPreview(null);setMessage("");setFileName("");if(ref.current)ref.current.value="";};

 async function load(file:File){
  setBusy(true);setMessage("");setPreview(null);
  try{
   const txt=(await file.text()).replace(/^\uFEFF/,"");const lines=txt.split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw new Error("CSV vacío");
   const d=lines[0].includes(";")?";":",";const h=parse(lines[0],d).map(norm);
   const aliases:Record<string,string[]>={
    client:["cliente","razon social","razon social cliente"],rut:["rut","rut cliente"],contract:["contrato","perfil","contrato perfil"],installation:["instalacion"],
    region:["region"],city:["ciudad"],commune:["comuna"],address:["direccion","direccion instalacion"],surface_m2:["superficie","superficie m2","superficie (m2)","m2","metros cuadrados"],
    collaborator_count:["n colaboradoras","n° colaboradoras","numero colaboradoras","dotacion","dotacion colaboradoras"],
    delivery_contact_name:["contacto entrega","contacto de entrega"],delivery_email:["email entrega","correo entrega"],general_email:["email general","correo general"],
    delivery_phone:["telefono entrega","fono entrega"],phone:["telefono general","telefono","fono"],delivery_notes:["notas entrega","observaciones entrega"],
    postal_code:["codigo postal"],latitude:["latitud"],longitude:["longitud"],access_hours:["horario acceso","horarios acceso"],
    technical_contact_name:["contacto tecnico"],technical_contact_email:["email tecnico","correo tecnico"],technical_contact_phone:["telefono tecnico","fono tecnico"],
    observations:["observaciones","observacion"]
   };
   const idx=(k:string)=>h.findIndex(x=>(aliases[k]||[]).includes(x));
   if(idx("client")<0||idx("contract")<0||idx("installation")<0)throw new Error("Debe incluir Cliente, Contrato e Instalación");
   const keys=Object.keys(aliases);
   const parsed:Row[]=lines.slice(1).map(l=>{const a=parse(l,d),row:Record<string,string>={};for(const k of keys)if(idx(k)>=0)row[k]=(a[idx(k)]||"").trim();return row as Row;}).filter(r=>r.client||r.installation);
   if(!parsed.length)throw new Error("No se encontraron instalaciones válidas");
   setRows(parsed);setFileName(file.name);setPreview(await previewInstallationCsvRows(parsed));
  }catch(e:any){setMessage(e?.message||"No se pudo analizar el CSV");}
  finally{setBusy(false);}
 }

 async function confirm(){
  if(!rows.length||!preview)return;
  setBusy(true);setMessage("");
  try{
   const r=await confirmInstallationCsvRows(rows);
   setMessage(`Carga confirmada: ${r.created} nuevas, ${r.updated||0} actualizadas, ${r.exists} sin cambios, ${r.review} revisar, ${r.duplicates} duplicadas.`);
   setPreview(null);setRows([]);setFileName("");if(ref.current)ref.current.value="";window.location.reload();
  }catch(e:any){setMessage(e?.message||"No se pudo confirmar");}
  finally{setBusy(false);}
 }

 return <div className="clientCsvImport">
  <div className="clientCsvTop"><input ref={ref} type="file" accept=".csv,text/csv" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f);}}/><span>{busy?"Procesando...":fileName||"Cargar instalaciones CSV"}</span></div>
  <p style={{margin:"10px 0 0"}}><b>Cargar instalaciones CSV.</b> Usa clientes y contratos existentes. Puede crear instalaciones realmente nuevas o completar instalaciones existentes reconocidas por nombre, alias o dirección.</p>
  {message&&<p className="note">{message}</p>}
  {preview&&<><div className="clientCsvSummary"><span>{preview.total} leídas</span><span>{preview.new} nuevas</span><span>{preview.exists} existentes/actualizables</span><span>{preview.review} revisar</span><span>{preview.duplicates} duplicadas</span></div>
   <div className="clientCsvTable"><table><thead><tr><th>Cliente</th><th>Contrato</th><th>Instalación</th><th>Resultado</th><th>Detalle</th></tr></thead><tbody>{preview.details.map((d:any)=><tr key={`${d.index}-${d.installation}`}><td>{d.client}</td><td>{d.contract}</td><td>{d.installation}</td><td><b>{d.status}</b></td><td>{d.reason||"—"}</td></tr>)}</tbody></table></div>
   {(preview.review>0||preview.duplicates>0)&&<p className="warning">Las filas REVISAR o DUPLICADA no se procesarán automáticamente.</p>}
   <div className="clientCsvActions"><button type="button" disabled={busy||(preview.new===0&&preview.exists===0)} onClick={confirm}>{busy?"Confirmando...":"Confirmar carga segura"}</button><button type="button" className="clearFilters" disabled={busy} onClick={reset}>Cancelar</button></div>
  </>}
 </div>;
}
