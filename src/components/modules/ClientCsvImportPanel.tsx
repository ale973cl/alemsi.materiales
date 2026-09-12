"use client";

import {useRef,useState} from "react";
import {confirmClientsCsvRows,previewClientsCsvRows} from "@/app/client-import-actions";
import InstallationCsvImportPanel from "@/components/modules/InstallationCsvImportPanel";

type Row={name?:string;email?:string;rut?:string;activity?:string;phone?:string;commune?:string;address?:string};
type Preview={total:number;created:number;updated:number;unchanged:number;review:number;duplicates:number;details:Array<{index:number;name:string;rut:string;status:string;reason?:string;changes?:Record<string,string>}>};

const parseLine=(line:string,delimiter:string)=>{const out:string[]=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(ch===delimiter&&!quoted){out.push(value.trim());value=""}else value+=ch}out.push(value.trim());return out};
const norm=(v:string)=>String(v||"").trim().toLocaleLowerCase("es-CL").normalize("NFD").replace(/[\u0300-\u036f]/g,"");

export default function ClientCsvImportPanel(){
 const inputRef=useRef<HTMLInputElement|null>(null);
 const [fileName,setFileName]=useState(""),[rows,setRows]=useState<Row[]>([]),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const reset=()=>{setRows([]);setPreview(null);setFileName("");setMessage("");if(inputRef.current)inputRef.current.value=""};
 const loadFile=async(file:File)=>{
  setBusy(true);setMessage("");setPreview(null);
  try{
   const content=(await file.text()).replace(/^\uFEFF/,"");const lines=content.split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw new Error("El CSV no contiene clientes");
   const delimiter=lines[0].includes(";")?";":",";const headers=parseLine(lines[0],delimiter).map(norm);
   const aliases:Record<string,string[]>= {name:["nombre","cliente","razon social","razon_social"],email:["email","correo"],rut:["rut"],activity:["actividad","giro"],phone:["telefono","telefono cliente","fono"],commune:["comuna"],address:["direccion","direccion cliente"]};
   const idx=(key:string)=>headers.findIndex(h=>aliases[key].includes(h));
   if(idx("name")<0||idx("rut")<0)throw new Error("El CSV debe contener al menos las columnas Nombre y RUT");
   const parsed=lines.slice(1).map(line=>{const values=parseLine(line,delimiter);const get=(k:string)=>idx(k)>=0?(values[idx(k)]||"").trim():"";return{name:get("name"),email:get("email"),rut:get("rut"),activity:get("activity"),phone:get("phone"),commune:get("commune"),address:get("address")};}).filter(r=>r.name||r.rut);
   if(!parsed.length)throw new Error("No se encontraron filas válidas");
   setRows(parsed);setFileName(file.name);
   const result=await previewClientsCsvRows(parsed);setPreview(result as Preview);
  }catch(error:any){setMessage(error?.message||"No se pudo analizar el CSV")}
  finally{setBusy(false)}
 };
 const confirm=async()=>{if(!rows.length||!preview)return;setBusy(true);setMessage("");try{const result=await confirmClientsCsvRows(rows);setMessage(`Carga confirmada: ${result.created} nuevos, ${result.updated} actualizados, ${result.skipped} sin modificación.`);setPreview(null);setRows([]);setFileName("");if(inputRef.current)inputRef.current.value="";window.location.reload();}catch(error:any){setMessage(error?.message||"No se pudo confirmar la carga")}finally{setBusy(false)}};
 return <><div className="clientCsvImport">
  <style dangerouslySetInnerHTML={{__html:`
   .clientCsvImport{margin:12px 0;padding:14px;border:1px solid #c8dce8;border-radius:12px;background:#f8fbfd}
   .clientCsvTop{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.clientCsvTop input{max-width:320px}.clientCsvSummary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.clientCsvSummary span{padding:7px 10px;border-radius:999px;background:#eef5f8;font-size:12px;font-weight:700;color:#173650}
   .clientCsvTable{max-height:280px;overflow:auto;border:1px solid #d7e4eb;border-radius:10px;background:#fff}.clientCsvTable table{width:100%;border-collapse:collapse;font-size:12px}.clientCsvTable th,.clientCsvTable td{padding:8px 10px;border-bottom:1px solid #edf2f5;text-align:left;vertical-align:top}.clientCsvTable th{position:sticky;top:0;background:#f4f8fa;z-index:1}.clientCsvActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.clientCsvImport .warning{color:#8a4b00;font-weight:700}
  `}}/>
  <div className="clientCsvTop"><input ref={inputRef} type="file" accept=".csv,text/csv" onChange={e=>{const f=e.target.files?.[0];if(f)void loadFile(f)}}/><span>{busy?"Procesando...":fileName||"Selecciona el CSV maestro de clientes"}</span></div>
  <p style={{margin:"10px 0 0"}}>Esta carga administra solo el <b>cliente legal por RUT</b>. No crea contratos ni instalaciones.</p>
  {message&&<p className="note">{message}</p>}
  {preview&&<><div className="clientCsvSummary"><span>{preview.total} filas</span><span>{preview.created} nuevos</span><span>{preview.updated} actualizar</span><span>{preview.unchanged} sin cambios</span><span>{preview.review} revisar</span><span>{preview.duplicates} duplicados CSV</span></div>
   <div className="clientCsvTable"><table><thead><tr><th>Cliente</th><th>RUT</th><th>Resultado</th><th>Detalle</th></tr></thead><tbody>{preview.details.map(d=><tr key={`${d.index}-${d.rut}`}><td>{d.name}</td><td>{d.rut}</td><td><b>{d.status}</b></td><td>{d.reason||Object.keys(d.changes||{}).join(", ")||"—"}</td></tr>)}</tbody></table></div>
   {(preview.review>0||preview.duplicates>0)&&<p className="warning">Los registros en revisión o duplicados no se cargarán al confirmar.</p>}
   <div className="clientCsvActions"><button type="button" disabled={busy} onClick={confirm}>{busy?"Confirmando...":"Confirmar actualización"}</button><button type="button" className="clearFilters" disabled={busy} onClick={reset}>Cancelar</button></div></>}
 </div><InstallationCsvImportPanel/></>;
}
