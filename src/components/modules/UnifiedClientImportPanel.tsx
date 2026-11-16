"use client";

import {useMemo,useRef,useState} from "react";
import {confirmUnifiedClientCsv,previewUnifiedClientCsv} from "@/app/client-unified-import-actions";
import type {UnifiedCsvRow} from "@/lib/client-unified-import";

type Detail={row:number;level:"Cliente"|"Contrato"|"Instalación"|"Material";item:string;status:"NUEVO"|"EXISTE"|"CONFLICTO"|"DUPLICADO";reason?:string};
type Summary={rows:number;clientsNew:number;clientsExisting:number;contractsNew:number;contractsExisting:number;installationsNew:number;installationsExisting:number;assignmentsNew:number;assignmentsExisting:number;conflicts:number;duplicates:number;newTotal:number};

const TEMPLATE="/plantilla-cliente-contrato-instalacion.csv";
const CSV_HEADERS="cliente_nombre;cliente_rut;cliente_correo;cliente_telefono;contrato_nombre;contrato_codigo;presupuesto_neto_clp;instalacion_nombre;region;comuna;direccion;contacto_entrega;correo_entrega;periodicidad_contrato;ciudad";

const PROMPT=`Eres extractor documental del sistema ALEMSI Materiales. Usa EXCLUSIVAMENTE los documentos adjuntos: contrato, bases administrativas, bases técnicas y anexos. No inventes información.

PROCESO 1 — CSV ADMINISTRATIVO PARA IMPORTACIÓN
Extrae únicamente cliente, contrato e instalaciones. NO extraigas materiales, cantidades de materiales, equivalencias de productos, máximos autorizados ni listas de insumos para el CSV: se configuran después en ALEMSI a partir del Maestro de Materiales, por contrato y luego instalación por instalación.

Entrega un archivo CSV UTF-8 con separador ; (punto y coma), exactamente con estas columnas y en este orden:
${CSV_HEADERS}

REGLAS DEL CSV
- Una fila por instalación de cada contrato; repite los datos de cliente y contrato en esas filas. Si no hay instalaciones documentadas, crea una fila con instalacion_nombre vacío.
- Solo datos explícitos en las bases. Campos sin evidencia = celdas vacías; nunca inventar datos.
- cliente_rut: solo si está documentado, conserva el dígito verificador.
- contrato_codigo: código/ID oficial, si está documentado.
- presupuesto_neto_clp: solo monto NETO verificable, sin símbolo de moneda, sin puntos de miles.
- periodicidad_contrato: frecuencia del CONTRATO cuando esté especificada; no confundir frecuencia de aseo con periodicidad de abastecimiento.
- Una sola fila por instalación, no repetirla por cada material.
- Los nombres de columnas no llevan tildes. Para el CONTENIDO, conserva español correcto y acentos en UTF-8; nunca entregues texto corrupto como "RegiÃ³n" o "SubsecretarÃ­a".
- Normaliza espacios, saltos de línea internos y caracteres Unicode; no modifiques nombres oficiales ni elimines tildes indiscriminadamente.
- Entrecomilla un campo si contiene punto y coma, comillas o saltos de línea; duplica las comillas internas según CSV.
- Sin tablas Markdown, delimitadores verticales |, encabezados decorativos, JSON ni bloques de código dentro del archivo.
- No incluyas comentarios o informes debajo de las filas del CSV.

PROCESO 2 — INFORME CONTRACTUAL SEPARADO, NO IMPORTABLE
Entrega un documento independiente titulado INFORME DE OBLIGACIONES DEL PROVEEDOR. Señala servicios exigidos, productos o materiales especificados en bases, cláusulas "o similar", cantidades expresamente documentadas, cobertura, dotación, turnos, frecuencias, seguridad, EPP, supervisión, entregables, plazos, multas y ambigüedades. Cita documento, cláusula y página cuando sea posible. No conviertas insumos exigidos en productos del Maestro ALEMSI y no afirmes equivalencias técnicas sin evidencia.

ENTREGA FINAL
1. Archivo CSV administrativo descargable (UTF-8; separador ;).
2. Informe de obligaciones independiente (texto o documento). Si la plataforma no puede adjuntar archivos, presenta ambos resultados claramente separados para guardarlos por separado. El informe JAMÁS forma parte del CSV.`;
const HEADER_ALIASES:Record<string,string[]> = {
 client_name:["cliente_nombre","cliente","nombre_cliente","razon_social","razon_social_cliente"],
 client_rut:["cliente_rut","rut","rut_cliente"],
 client_email:["cliente_correo","correo_cliente","email_cliente","correo","email"],
 client_phone:["cliente_telefono","telefono_cliente","fono_cliente","telefono"],
 contract_name:["contrato_nombre","contrato","nombre_contrato"],
 contract_code:["contrato_codigo","codigo_contrato","codigo"],
 contract_budget:["presupuesto_neto_clp","presupuesto_neto","presupuesto","flujo_economico"],
 contract_periodicity:["periodicidad_contrato","periodicidad"],
 installation_name:["instalacion_nombre","instalacion","dependencia"],
 region:["region"],
 commune:["comuna"],
 city:["ciudad"],
 address:["direccion","direccion_instalacion"],
 delivery_contact:["contacto_entrega","contacto_de_entrega","contacto_recepcion"],
 delivery_email:["correo_entrega","email_entrega","correo_contacto"],
 material_code:["material_codigo","codigo_material"],
 material_name:["material_nombre","material","producto","nombre_material"],
 material_presentation:["material_presentacion","presentacion"],
 quantity:["cantidad_asignada","cantidad","cantidad_maxima","cantidad_maxima_instalacion"],
 unit:["unidad"],
 quantity_scope:["alcance_cantidad","alcance"],
};

const normHeader=(v:string)=>String(v||"").replace(/^\uFEFF/,"").trim().toLocaleLowerCase("es-CL").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_");
const text=(v:unknown)=>String(v??"").trim();

function parseCsv(content:string,delimiter:string){
 const rows:string[][]=[];
 let row:string[]=[],value="",quoted=false;
 for(let i=0;i<content.length;i++){
  const ch=content[i];
  if(quoted){
   if(ch==='"'){if(content[i+1]==='"'){value+='"';i++;}else quoted=false;}
   else value+=ch;
  }else if(ch==='"')quoted=true;
  else if(ch===delimiter){row.push(value.trim());value="";}
  else if(ch==="\n"){row.push(value.trim());rows.push(row);row=[];value="";}
  else if(ch!=="\r")value+=ch;
 }
 if(value||row.length){row.push(value.trim());rows.push(row);}
 return rows.filter(r=>r.some(v=>v.trim()));
}

export default function UnifiedClientImportPanel(){
 const inputRef=useRef<HTMLInputElement|null>(null);
 const guideRef=useRef<HTMLDivElement|null>(null);
 const [rows,setRows]=useState<UnifiedCsvRow[]>([]);
 const [preview,setPreview]=useState<{summary:Summary;details:Detail[]}|null>(null);
 const [summary,setSummary]=useState<Summary|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [fileName,setFileName]=useState("");
 const [showPrompt,setShowPrompt]=useState(false);
 const [showGuide,setShowGuide]=useState(false);
 const [onlyConflicts,setOnlyConflicts]=useState(false);

 const reset=()=>{setRows([]);setPreview(null);setSummary(null);setMessage("");setFileName("");setOnlyConflicts(false);if(inputRef.current)inputRef.current.value="";};

 const copyPrompt=async()=>{
  try{
   await navigator.clipboard.writeText(PROMPT);
   setMessage("Prompt completo copiado. Pégalo en Meta AI, Gemini o ChatGPT junto con el contrato.");
  }catch{
   const helper=document.createElement("textarea");
   helper.value=PROMPT;helper.style.position="fixed";helper.style.opacity="0";document.body.appendChild(helper);helper.select();
   const ok=document.execCommand("copy");helper.remove();
   setMessage(ok?"Prompt completo copiado. Pégalo en Meta AI, Gemini o ChatGPT junto con el contrato.":"No se pudo copiar automáticamente. Abre «Ver prompt» y cópialo manualmente.");
  }
 };

 async function loadFile(file:File){
  setBusy(true);setMessage("");setPreview(null);setSummary(null);
  try{
   if(file.size>4_000_000)throw new Error("El CSV supera el máximo de 4 MB");
   const content=(await file.text()).replace(/^\uFEFF/,"");
   const firstLine=content.split(/\r?\n/)[0]||"";
   const delimiter=firstLine.includes(";")?";":firstLine.includes(",")?",":"";
   if(!delimiter)throw new Error("El CSV debe usar punto y coma (;) como separador");
   const parsed=parseCsv(content,delimiter);
   if(parsed.length<2)throw new Error("El CSV no contiene filas de datos");
   const headers=parsed[0].map(normHeader);
   const indexFor=(key:string)=>{
    for(const alias of HEADER_ALIASES[key]||[]){const at=headers.indexOf(alias);if(at>=0)return at;}
    return -1;
   };
   const required:Array<[string,string]>=[["client_name","cliente_nombre"],["client_rut","cliente_rut"],["contract_name","contrato_nombre"]];
   for(const [key,label] of required)if(indexFor(key)<0)throw new Error(`Falta la columna obligatoria ${label}`);
   const keys=Object.keys(HEADER_ALIASES);
   const parsedRows:UnifiedCsvRow[]=parsed.slice(1).map((values,index)=>{
    const row:Record<string,string>={};
    for(const key of keys){const at=indexFor(key);if(at>=0)row[key]=text(values[at]);}
    return{...row,row:index+2} as UnifiedCsvRow;
   }).filter(r=>text(r.client_name)||text(r.client_rut)||text(r.contract_name));
   if(!parsedRows.length)throw new Error("No se encontraron filas con datos de cliente, RUT o contrato");
   if(parsedRows.length>2000)throw new Error("El CSV supera el máximo de 2.000 filas");
   setRows(parsedRows);setFileName(file.name);
   const result=await previewUnifiedClientCsv(parsedRows);
   setPreview({summary:result.summary,details:result.details as Detail[]});
   setSummary(result.summary);
  }catch(error:any){setMessage(error?.message||"No se pudo analizar el CSV");}
  finally{setBusy(false);}
 }

 async function confirm(){
  if(!rows.length||!preview)return;
  setBusy(true);setMessage("");
  try{
   const result=await confirmUnifiedClientCsv(rows,fileName);
   setMessage(result.message);
   setSummary(result.summary);
   setPreview(null);
   window.setTimeout(()=>window.location.reload(),1600);
  }catch(error:any){setMessage(error?.message||"No se pudo confirmar la importación");}
  finally{setBusy(false);}
 }

 function printGuide(){
  const previous=document.title;
  document.title="ALEMSI_Guia_Importacion_CSV";
  window.setTimeout(()=>{window.print();document.title=previous;},60);
 }

 const visible=useMemo(()=>{
  if(!preview)return[];
  return onlyConflicts?preview.details.filter(d=>d.status==="CONFLICTO"||d.status==="DUPLICADO"):preview.details;
 },[preview,onlyConflicts]);

 return <div className="unifiedImport">
  <style dangerouslySetInnerHTML={{__html:`
   .unifiedImport{margin:12px 0;padding:16px;border:1px solid #9bcac2;border-radius:14px;background:#f6fbfa}
   .unifiedHead{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
   .unifiedHead h3{margin:0;color:#0b2f4a}.unifiedHead p{margin:5px 0 0;color:#557084;max-width:760px}
   .unifiedToolbar{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:13px 0}
   .unifiedToolbar .fileBtn,.unifiedToolbar a,.unifiedToolbar button{display:inline-flex;align-items:center;min-height:38px;padding:0 12px;border:1px solid #0b2f4a;border-radius:9px;background:#fff;color:#0b2f4a;font-weight:800;text-decoration:none;cursor:pointer}
   .unifiedToolbar .fileBtn{background:#0b2f4a;color:#fff}
   .unifiedToolbar .fileBtn input{display:none}
   .unifiedChips{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
   .unifiedChips span{padding:7px 10px;border-radius:999px;background:#eef5f8;font-size:12px;font-weight:800;color:#173650}
   .unifiedChips .ok{background:#e4f5f1;color:#07594f}.unifiedChips .warn{background:#fff3d9;color:#7a5410}.unifiedChips .bad{background:#fde8e8;color:#8a1f1f}
   .unifiedTable{max-height:360px;overflow:auto;border:1px solid #d7e4eb;border-radius:10px;background:#fff}
   .unifiedTable table{width:100%;border-collapse:collapse;font-size:12px}
   .unifiedTable th,.unifiedTable td{padding:8px 10px;border-bottom:1px solid #edf2f5;text-align:left;vertical-align:top}
   .unifiedTable th{position:sticky;top:0;background:#f4f8fa;z-index:1}
   .unifiedTable tr.conflict td{background:#fff5f5}.unifiedTable tr.duplicate td{background:#fffaf0}
   .unifiedTable .tag{font-weight:900}.unifiedTable .tag.NUEVO{color:#07594f}.unifiedTable .tag.EXISTE{color:#245c72}.unifiedTable .tag.CONFLICTO{color:#a11d1d}.unifiedTable .tag.DUPLICADO{color:#8a5b00}
   .unifiedActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:13px;align-items:center}
   .unifiedActions button{padding:10px 15px;border-radius:9px;border:1px solid #0b2f4a;background:#0b2f4a;color:#fff;font-weight:800}
   .unifiedActions button.secondary{background:#fff;color:#0b2f4a}
   .unifiedActions button:disabled{opacity:.55;cursor:not-allowed}
   .unifiedPrompt{width:100%;min-height:210px;margin-top:10px;padding:10px;border:1px solid #c8dce8;border-radius:10px;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;background:#fff;color:#173650}
   .unifiedGuide{margin-top:16px;padding:16px;border:1px solid #c8dce8;border-radius:12px;background:#fff}
   .unifiedGuide h4{margin:0 0 8px;color:#0b2f4a}.unifiedGuide ol{padding-left:22px;line-height:1.65}.unifiedGuide li{margin-bottom:7px}
   .unifiedGuide .noteLine{padding:9px 11px;border-radius:9px;background:#eef7f8;color:#173650}
   @media print{body *{visibility:hidden}.unifiedGuide,.unifiedGuide *{visibility:visible}.unifiedGuide{position:absolute;left:0;top:0;width:100%;border:0}}
  `}}/>
  <div className="unifiedHead">
   <div><h3>Importar cliente, contratos e instalaciones</h3><p>CSV administrativo para crear cliente, contratos e instalaciones. Los materiales se configuran después desde el Maestro ALEMSI. Primero revisa la vista previa; nada se guarda hasta confirmar.</p></div>
   <button type="button" onClick={()=>void copyPrompt()}>Copiar prompt para IA</button>
  </div>
  <div className="unifiedToolbar">
   <label className="fileBtn">{busy?"Procesando…":"Seleccionar CSV único"}<input ref={inputRef} type="file" accept=".csv,text/csv" onChange={e=>{const file=e.target.files?.[0];if(file)void loadFile(file);}}/></label>
   <a href={TEMPLATE} download>Descargar plantilla CSV</a>
   <button type="button" onClick={()=>setShowPrompt(v=>!v)}>{showPrompt?"Ocultar prompt":"Ver prompt"}</button>
   <button type="button" onClick={()=>{setShowGuide(true);window.setTimeout(()=>guideRef.current?.scrollIntoView({behavior:"smooth"}),50);}}>Guía de uso</button>
  </div>
  <p style={{fontSize:12,color:"#557084",margin:"0 0 8px"}}>Separador punto y coma (;), UTF-8. La plantilla contiene únicamente 15 columnas administrativas. También se aceptan CSV antiguos de 21 columnas, pero sus materiales y cantidades se ignoran. Una segunda carga idéntica no duplica registros.</p>
  {showPrompt&&<textarea className="unifiedPrompt" readOnly value={PROMPT} onFocus={e=>e.currentTarget.select()} aria-label="Prompt completo para IA"/>}
  {message&&<p className="note">{message}</p>}
  {summary&&<div className="unifiedChips">
   <span>{summary.rows} filas</span>
   <span className="ok">+{summary.clientsNew} clientes</span>
   <span className="ok">+{summary.contractsNew} contratos</span>
   <span className="ok">+{summary.installationsNew} instalaciones</span>
   
   <span>{summary.clientsExisting+summary.contractsExisting+summary.installationsExisting} existentes</span>
   <span className={summary.conflicts?"bad":""}>{summary.conflicts} conflictos</span>
   <span className={summary.duplicates?"warn":""}>{summary.duplicates} duplicadas</span>
  </div>}
  {preview&&<>
   <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap",margin:"4px 0 8px"}}>
    <b>{fileName||"Vista previa"}</b>
    <label style={{display:"flex",gap:7,alignItems:"center",fontWeight:700}}><input type="checkbox" checked={onlyConflicts} onChange={e=>setOnlyConflicts(e.target.checked)}/>Ver solo conflictos y duplicadas</label>
   </div>
   <div className="unifiedTable"><table><thead><tr><th>Fila</th><th>Nivel</th><th>Elemento</th><th>Resultado</th><th>Detalle</th></tr></thead><tbody>
    {visible.map((d,index)=><tr key={`${d.row}-${d.level}-${d.item}-${d.status}-${index}`} className={d.status==="CONFLICTO"?"conflict":d.status==="DUPLICADO"?"duplicate":""}><td>{d.row}</td><td>{d.level}</td><td>{d.item}</td><td className={`tag ${d.status}`}>{d.status}</td><td>{d.reason||"—"}</td></tr>)}
   </tbody></table></div>
   {visible.length===0&&<p className="note">No hay conflictos ni duplicados en este archivo.</p>}
   {summary&&(summary.conflicts>0||summary.duplicates>0)&&<p className="warning"><b>Los conflictos y duplicados no se importarán.</b> Corrige el CSV y vuelve a cargarlo si necesitas incorporarlos.</p>}
   <div className="unifiedActions">
    <button type="button" disabled={busy||!summary||summary.newTotal===0} onClick={()=>void confirm()}>{busy?"Confirmando…":summary&&summary.newTotal>0?`Confirmar importación (${summary.newTotal} nuevos)`:"Sin registros nuevos"}</button>
    <button type="button" className="secondary" disabled={busy} onClick={reset}>Cancelar</button>
   </div>
  </>}
  {showGuide&&<div className="unifiedGuide" ref={guideRef}>
   <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}>
    <h4>Guía de uso — Importación única</h4>
    <span><button type="button" onClick={printGuide}>Imprimir / Guardar PDF</button> <button type="button" onClick={()=>setShowGuide(false)}>Cerrar guía</button></span>
   </div>
   <ol>
    <li><b>Descarga la plantilla.</b> Usa «Descargar plantilla CSV». No cambies los nombres ni el orden de las columnas.</li>
    <li><b>Copia el prompt.</b> Pulsa «Copiar prompt para IA». El texto completo queda en el portapapeles, sin recortes.</li>
    <li><b>Entrega contrato y prompt a la IA.</b> Adjunta el contrato, bases o anexos en Meta AI, Gemini o ChatGPT y pega el prompt. La IA debe extraer solo lo documentado.</li>
    <li><b>Guarda el CSV.</b> Guarda únicamente el bloque CSV en un archivo UTF-8 con separador «;». No incluyas la sección AMBIGÜEDADES dentro del archivo.</li>
    <li><b>Carga el archivo en ALEMSI.</b> Pulsa «Seleccionar CSV único». El sistema valida RUT, columnas y relaciones antes de mostrar la vista previa.</li>
    <li><b>Interpreta la vista previa.</b> NUEVO se creará; EXISTE se conservará; CONFLICTO requiere revisión; DUPLICADO aparece repetido en el archivo y se procesa una sola vez.</li>
    <li><b>Revisa conflictos.</b> Los conflictos no se importan. Corrige el CSV, vuelve a cargarlo y compara. Las cantidades ya configuradas nunca se sobrescriben automáticamente.</li>
    <li><b>Confirma una sola vez.</b> Pulsa «Confirmar importación». Si una operación falla, el sistema revierte los registros creados en esa ejecución. Reimportar el mismo archivo no genera duplicados.</li>
   </ol>
   <p className="noteLine"><b>Alcance de cantidades:</b> usa <b>alcance_cantidad=instalacion</b> solo cuando el documento indique un máximo para esa instalación. Usa <b>alcance_cantidad=contrato</b> para totales contractuales: se autoriza el material, pero la cantidad no se reparte entre instalaciones. Si no hay cantidad documentada, deja la celda vacía. Los materiales deben existir en el maestro; esta carga no inventa materiales.</p>
   <p style={{fontSize:12,color:"#557084"}}>El nombre del PDF lo sugiere el navegador según la configuración local de Chrome/Windows; ALEMSI define el título del documento y el contenido, no la carpeta de destino.</p>
  </div>}
 </div>;
}
