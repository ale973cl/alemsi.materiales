"use client";

import {useRef,useState} from "react";
import {confirmClientsCsvRows,previewClientsCsvRows} from "@/app/client-import-actions";
import {confirmInstallationCsvRows,previewInstallationCsvRows} from "@/app/installation-import-actions";

type ClientRow={name?:string;email?:string;rut?:string;activity?:string;phone?:string;commune?:string;address?:string};
type InstallationRow={client?:string;rut?:string;contract?:string;installation?:string;region?:string;city?:string;commune?:string;address?:string;collaborator_count?:string;delivery_contact_name?:string;delivery_email?:string;general_email?:string;delivery_phone?:string;phone?:string};
type Mode="client"|"installation"|null;

const parseLine=(line:string,delimiter:string)=>{const out:string[]=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){out.push(value.trim());value="";}else value+=ch;}out.push(value.trim());return out;};
const norm=(v:string)=>String(v||"").trim().toLocaleLowerCase("es-CL").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/_/g," ").replace(/\s+/g," ");

export default function ClientCsvImportPanel(){
 const inputRef=useRef<HTMLInputElement|null>(null);
 const [fileName,setFileName]=useState(""),[rows,setRows]=useState<any[]>([]),[preview,setPreview]=useState<any>(null),[mode,setMode]=useState<Mode>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const reset=()=>{setRows([]);setPreview(null);setFileName("");setMode(null);setMessage("");if(inputRef.current)inputRef.current.value="";};
 const loadFile=async(file:File)=>{
  setBusy(true);setMessage("");setPreview(null);setMode(null);
  try{
   const content=(await file.text()).replace(/^\uFEFF/,"");const lines=content.split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw new Error("El CSV no contiene registros");
   const delimiter=lines[0].includes(";")?";":",";const headers=parseLine(lines[0],delimiter).map(norm);
   const aliases:any={
    client:["cliente","razon social","razon social cliente"],rut:["rut","rut cliente"],contract:["contrato","perfil","contrato perfil"],installation:["instalacion"],region:["region"],city:["ciudad"],commune:["comuna"],address:["direccion","direccion cliente"],
    collaborator_count:["n colaboradoras","n° colaboradoras","numero colaboradoras"],delivery_contact_name:["contacto entrega","contacto de entrega"],delivery_email:["email entrega","correo entrega"],general_email:["email general","correo general"],delivery_phone:["telefono entrega","fono entrega"],phone:["telefono general","telefono","fono"],
    name:["nombre","cliente","razon social"],email:["email","correo"],activity:["actividad","giro"]
   };
   const idx=(key:string)=>headers.findIndex(h=>(aliases[key]||[]).includes(h));
   const isInstallation=idx("installation")>=0&&idx("contract")>=0&&idx("client")>=0;
   if(isInstallation){
    const parsed:InstallationRow[]=lines.slice(1).map(line=>{const values=parseLine(line,delimiter),get=(k:string)=>idx(k)>=0?(values[idx(k)]||"").trim():"";return{client:get("client"),rut:get("rut"),contract:get("contract"),installation:get("installation"),region:get("region"),city:get("city"),commune:get("commune"),address:get("address"),collaborator_count:get("collaborator_count"),delivery_contact_name:get("delivery_contact_name"),delivery_email:get("delivery_email"),general_email:get("general_email"),delivery_phone:get("delivery_phone"),phone:get("phone")};}).filter(r=>r.client||r.installation);
    if(!parsed.length)throw new Error("No se encontraron instalaciones válidas");setRows(parsed);setMode("installation");setFileName(file.name);setPreview(await previewInstallationCsvRows(parsed));
   }else{
    if(idx("name")<0||idx("rut")<0)throw new Error("El CSV debe contener Nombre y RUT, o bien Cliente + Contrato + Instalacion");
    const parsed:ClientRow[]=lines.slice(1).map(line=>{const values=parseLine(line,delimiter),get=(k:string)=>idx(k)>=0?(values[idx(k)]||"").trim():"";return{name:get("name"),email:get("email"),rut:get("rut"),activity:get("activity"),phone:get("phone"),commune:get("commune"),address:get("address")};}).filter(r=>r.name||r.rut);
    if(!parsed.length)throw new Error("No se encontraron clientes válidos");setRows(parsed);setMode("client");setFileName(file.name);setPreview(await previewClientsCsvRows(parsed));
   }
  }catch(error:any){setMessage(error?.message||"No se pudo analizar el CSV");}
  finally{setBusy(false);}
 };
 const confirm=async()=>{if(!rows.length||!preview||!mode)return;setBusy(true);setMessage("");try{if(mode==="installation"){const r=await confirmInstallationCsvRows(rows as InstallationRow[]);setMessage(`Carga confirmada: ${r.created} instalaciones agregadas, ${r.skipped} existentes omitidas, ${r.review} en revisión.`);}else{const r=await confirmClientsCsvRows(rows as ClientRow[]);setMessage(`Carga confirmada: ${r.created} clientes nuevos, ${r.updated} actualizados, ${r.skipped} sin modificación.`);}setPreview(null);setRows([]);setFileName("");setMode(null);if(inputRef.current)inputRef.current.value="";window.location.reload();}catch(error:any){setMessage(error?.message||"No se pudo confirmar la carga");}finally{setBusy(false);}};
 return <div className="clientCsvImport">
  <style dangerouslySetInnerHTML={{__html:`.clientCsvImport{margin:12px 0;padding:14px;border:1px solid #c8dce8;border-radius:12px;background:#f8fbfd}.clientCsvTop{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.clientCsvTop input{max-width:320px}.clientCsvSummary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.clientCsvSummary span{padding:7px 10px;border-radius:999px;background:#eef5f8;font-size:12px;font-weight:700;color:#173650}.clientCsvTable{max-height:280px;overflow:auto;border:1px solid #d7e4eb;border-radius:10px;background:#fff}.clientCsvTable table{width:100%;border-collapse:collapse;font-size:12px}.clientCsvTable th,.clientCsvTable td{padding:8px 10px;border-bottom:1px solid #edf2f5;text-align:left;vertical-align:top}.clientCsvTable th{position:sticky;top:0;background:#f4f8fa;z-index:1}.clientCsvActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.clientCsvImport .warning{color:#8a4b00;font-weight:700}`}}/>
  <div className="clientCsvTop"><input ref={inputRef} type="file" accept=".csv,text/csv" onChange={e=>{const f=e.target.files?.[0];if(f)void loadFile(f);}}/><span>{busy?"Procesando...":fileName||"Selecciona CSV de clientes o instalaciones"}</span></div>
  <p style={{margin:"10px 0 0"}}>{mode==="installation"?<><b>Modo instalaciones:</b> usa cliente y contrato existentes; agrega solo instalaciones faltantes y completa los datos disponibles.</>:mode==="client"?<><b>Modo clientes:</b> administra el cliente legal por RUT.</>:<>El cargador detecta automáticamente si el archivo es de <b>clientes</b> o de <b>instalaciones</b>.</>}</p>
  {message&&<p className="note">{message}</p>}
  {preview&&mode==="installation"&&<><div className="clientCsvSummary"><span>{preview.total} filas</span><span>{preview.add} agregar</span><span>{preview.exists} existentes</span><span>{preview.review} revisar</span></div><div className="clientCsvTable"><table><thead><tr><th>Cliente</th><th>Contrato</th><th>Instalación</th><th>Resultado</th><th>Detalle</th></tr></thead><tbody>{preview.details.map((d:any)=><tr key={`${d.index}-${d.installation}`}><td>{d.client}</td><td>{d.contract}</td><td>{d.installation}</td><td><b>{d.status}</b></td><td>{d.reason||"—"}</td></tr>)}</tbody></table></div><div className="clientCsvActions"><button type="button" disabled={busy||preview.add===0} onClick={confirm}>{busy?"Confirmando...":"Confirmar solo instalaciones faltantes"}</button><button type="button" className="clearFilters" disabled={busy} onClick={reset}>Cancelar</button></div></>}
  {preview&&mode==="client"&&<><div className="clientCsvSummary"><span>{preview.total} filas</span><span>{preview.created} nuevos</span><span>{preview.updated} actualizar</span><span>{preview.unchanged} sin cambios</span><span>{preview.review} revisar</span><span>{preview.duplicates} duplicados CSV</span></div><div className="clientCsvTable"><table><thead><tr><th>Cliente</th><th>RUT</th><th>Resultado</th><th>Detalle</th></tr></thead><tbody>{preview.details.map((d:any)=><tr key={`${d.index}-${d.rut}`}><td>{d.name}</td><td>{d.rut}</td><td><b>{d.status}</b></td><td>{d.reason||Object.keys(d.changes||{}).join(", ")||"—"}</td></tr>)}</tbody></table></div><div className="clientCsvActions"><button type="button" disabled={busy} onClick={confirm}>{busy?"Confirmando...":"Confirmar actualización"}</button><button type="button" className="clearFilters" disabled={busy} onClick={reset}>Cancelar</button></div></>}
 </div>;
}
