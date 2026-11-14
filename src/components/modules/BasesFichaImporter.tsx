"use client";
import {useState} from "react";
import {createFromBasesFicha,previewBasesFicha,type BasesFicha} from "@/app/bases-import-actions";

export default function BasesFichaImporter(){
 const [opened,setOpened]=useState(false),[raw,setRaw]=useState(""),[file,setFile]=useState(""),[pending,setPending]=useState(false),[preview,setPreview]=useState<Awaited<ReturnType<typeof previewBasesFicha>>|null>(null),[message,setMessage]=useState("");
 const load=async(f:File)=>{setMessage("");setPreview(null);setFile(f.name);setRaw(await f.text())};
 const review=async()=>{
  setMessage("");setPending(true);setPreview(null);
  try{const ficha=JSON.parse(raw) as BasesFicha;const p=await previewBasesFicha(ficha);setPreview(p);if(p.errors.length)setMessage("Revisa los errores antes de confirmar. Puedes corregir el JSON en el cuadro.");}
  catch(e){setMessage(e instanceof Error?e.message:"Formato JSON inválido");}
  finally{setPending(false)}
 };
 const confirm=async()=>{
  if(!preview||preview.errors.length)return;
  setPending(true);setMessage("");
  try{const result=await createFromBasesFicha(JSON.parse(raw) as BasesFicha);setMessage("Ficha creada: "+result.installations+" instalaciones. "+result.materialsPending+" materiales contractuales pendientes de asignar por instalación.");setPreview(null);setRaw("");setFile("");}
  catch(e){setMessage(e instanceof Error?e.message:"No fue posible importar");}
  finally{setPending(false)}
 };
 return <div style={{margin:"12px 0"}}>
  <button type="button" onClick={()=>setOpened(v=>!v)} style={{padding:"10px 14px",border:"1px solid #0d6a6d",background:"white",borderRadius:9,fontWeight:700,color:"#0d5960"}}>{opened?"Cerrar importación de bases":"Importar ficha preparada con IA"}</button>
  {opened&&<section className="panel" style={{marginTop:12,padding:18,maxWidth:860}}>
   <h3 style={{margin:"0 0 8px"}}>Crear cliente, contrato e instalaciones desde las bases</h3>
   <p>Entrega las bases a una IA junto con nuestra instrucción. La IA devuelve una ficha JSON. Revísala y cárgala aquí. Los materiales del contrato NO se distribuyen automáticamente a las instalaciones.</p>
   <div style={{display:"flex",gap:12,flexWrap:"wrap",margin:"12px 0"}}>
    <a href="/ficha-contrato-ejemplo.json" download>Descargar formato JSON</a>
    <a href="https://github.com/ale973cl/alemsi.materiales/blob/feat/alemsi-simple-20261114/docs/PROMPT_IA_BASES_CONTRATO.md" target="_blank" rel="noreferrer">Instrucción para IA</a>
   </div>
   <label style={{display:"grid",gap:6,fontWeight:700}}>Seleccionar ficha generada (.json)<input type="file" accept=".json,application/json" onChange={e=>{const x=e.target.files?.[0];if(x)void load(x)}}/></label>
   {file&&<small>Archivo: {file}</small>}
   <label style={{display:"grid",gap:6,marginTop:12,fontWeight:700}}>Revisar y corregir ficha JSON<textarea spellCheck={false} value={raw} onChange={e=>{setRaw(e.target.value);setPreview(null)}} rows={9} style={{width:"100%",fontFamily:"monospace",fontSize:12,padding:10,border:"1px solid #cedee5",borderRadius:9}} placeholder="Pega el JSON generado por la IA o carga un archivo .json"/></label>
   <button type="button" onClick={review} disabled={!raw.trim()||pending} style={{marginTop:12}}>{pending?"Procesando...":"Validar ficha"}</button>
   {preview&&<div style={{border:"1px solid #c8dde5",borderRadius:10,padding:14,marginTop:12}}>
    <b>Vista previa — {preview.summary.cliente}</b>
    <p>RUT: {preview.summary.rut} · Contrato: {preview.summary.contrato} ({preview.summary.codigo})</p>
    <p>{preview.summary.instalaciones} instalaciones · {preview.summary.materiales} materiales por distribuir · {preview.existingClientId?"Cliente existente: se creará contrato nuevo":"Cliente nuevo"}</p>
    {!!preview.errors.length&&<div style={{color:"#9d1c1c"}}><b>Errores:</b><ul>{preview.errors.map((t,i)=><li key={i}>{t}</li>)}</ul></div>}
    {!!preview.warnings.length&&<div style={{color:"#87570a"}}><b>Advertencias:</b><ul>{preview.warnings.map((t,i)=><li key={i}>{t}</li>)}</ul></div>}
    {!preview.errors.length&&<button type="button" disabled={pending} onClick={confirm}>Confirmar creación de ficha</button>}
   </div>}
   {message&&<p role="status" style={{marginTop:12,fontWeight:650}}>{message}</p>}
  </section>}
 </div>
}
