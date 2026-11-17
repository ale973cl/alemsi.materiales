"use client";
import {Fragment,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {importMaterialMasterCsv} from "@/app/material-csv-actions";
import {updateMaterialNetPrice} from "@/app/material-price-actions";
import {createMaterialConfigured,getMaterialConfiguration,updateMaterialConfiguration} from "@/app/material-config-actions";

export type MaterialCatalogRow={id?:string;family?:string|null;supplier?:string|null;supplier_code?:string|null;product?:string|null;presentation?:string|null;unit?:string|null;net_value?:number|string|null;availability?:number|string|null;duplicate_count?:number};
type Supplier={id:string;legal_name:string;fantasy_name?:string|null;rut?:string|null;active:boolean};
type MaterialLink={supplier_id:string;priority:number|null;supplier_code?:string|null};
const text=(v:unknown)=>String(v??"").trim();
const normalized=(v:unknown)=>text(v).toLocaleLowerCase("es-CL");
const money=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n):"—"};
const quantity=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("es-CL",{maximumFractionDigits:2}).format(n):"0"};
const supplierLabel=(s:Supplier)=>{const fantasy=text(s.fantasy_name),legal=text(s.legal_name);return fantasy&&normalized(fantasy)!==normalized(legal)?`${fantasy} — ${legal}`:(fantasy||legal)};

function SupplierFields({suppliers,prefix,defaults}:{suppliers:Supplier[];prefix:string;defaults?:Record<number,{supplier_id?:string;supplier_code?:string}>}){
 return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,gridColumn:"1 / -1",width:"100%",minWidth:0}}>
  {[1,2,3].map(priority=><div key={priority} style={{display:"grid",gap:6,padding:10,border:"1px solid #d6e5e8",borderRadius:10,background:"#fff",minWidth:0,overflow:"hidden"}}>
   <label style={{display:"grid",gap:5,minWidth:0}}>Proveedor {priority===1?"primario":priority===2?"secundario":"tercero"}
    <select name={`${prefix}supplier_${priority}`} defaultValue={defaults?.[priority]?.supplier_id||""} style={{width:"100%",maxWidth:"100%",minWidth:0,boxSizing:"border-box"}}>
     <option value="">Sin asignar</option>{suppliers.map(s=><option key={s.id} value={s.id}>{supplierLabel(s)}{s.rut?` · ${s.rut}`:""}</option>)}
    </select>
   </label>
   <label style={{display:"grid",gridTemplateColumns:"auto minmax(0,1fr)",alignItems:"center",gap:8,minWidth:0}}>Código proveedor<input name={`${prefix}supplier_code_${priority}`} defaultValue={defaults?.[priority]?.supplier_code||""} placeholder="Código del proveedor" style={{width:"100%",maxWidth:"100%",minWidth:0,boxSizing:"border-box"}}/></label>
  </div>)}
 </div>
}

export default function MaterialsCatalogModule({rows,sourceCount,error}:{rows:MaterialCatalogRow[];sourceCount:number;error?:string|null}){
 const router=useRouter();
 const [search,setSearch]=useState(""),[family,setFamily]=useState(""),[supplier,setSupplier]=useState("");
 const [screen,setScreen]=useState<"list"|"create"|"import"|"config"|"price">("list");
 const [editing,setEditing]=useState<string|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[localPrices,setLocalPrices]=useState<Record<string,number>>({});
 const [suppliers,setSuppliers]=useState<Supplier[]>([]),[configId,setConfigId]=useState<string|null>(null),[configMaterial,setConfigMaterial]=useState<any>(null),[configLinks,setConfigLinks]=useState<Record<number,{supplier_id?:string;supplier_code?:string}>>({}),[loadingConfig,setLoadingConfig]=useState(false);
 useEffect(()=>{fetch("/api/suppliers").then(r=>r.json()).then(data=>setSuppliers((data.suppliers||[]).filter((s:Supplier)=>s.active))).catch(()=>setSuppliers([]))},[]);
 const families=useMemo(()=>Array.from(new Set(rows.map(r=>text(r.family)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es")),[rows]);
 const supplierFilters=useMemo(()=>Array.from(new Set(rows.map(r=>text(r.supplier)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es")),[rows]);
 const filtered=useMemo(()=>{const term=normalized(search);return rows.filter(r=>(!family||text(r.family)===family)&&(!supplier||text(r.supplier)===supplier)&&(!term||[r.family,r.supplier,r.supplier_code,r.product,r.presentation,r.unit].some(v=>normalized(v).includes(term))))},[rows,search,family,supplier]);
 const editingRow=rows.find(r=>r.id===editing)||null;
 const back=()=>{setScreen("list");setEditing(null);setConfigId(null);setConfigMaterial(null);setMessage("")};

 async function savePrice(formData:FormData){
  setSaving(true);setMessage("Guardando...");
  try{
   const result=await updateMaterialNetPrice(formData);
   if(!result?.ok){setMessage(result?.error||"No fue posible actualizar el precio");return}
   if(result.material_id)setLocalPrices(current=>({...current,[result.material_id]:Number(result.new_price||0)}));
   setMessage(result.message||"Precio actualizado correctamente");
   router.refresh();
   setTimeout(()=>back(),250);
  }catch(err:any){setMessage(err?.message||"No fue posible actualizar el precio")}
  finally{setSaving(false)}
 }
 async function createConfigured(formData:FormData){
  setSaving(true);setMessage("Guardando producto...");
  try{
   const normalizedForm=new FormData();for(const [k,v] of formData.entries())normalizedForm.set(k.replace(/^new_/,""),v);
   const result=await createMaterialConfigured(normalizedForm);setMessage(result.message);router.refresh();setTimeout(()=>back(),250);
  }catch(err:any){setMessage(err?.message||"No fue posible crear el producto")}
  finally{setSaving(false)}
 }
 async function importMaster(formData:FormData){
  setSaving(true);setMessage("Validando y actualizando maestro...");
  try{const result=await importMaterialMasterCsv(formData);setMessage(result?.message||"Maestro actualizado correctamente");router.refresh();setTimeout(()=>back(),250)}
  catch(err:any){setMessage(err?.message||"No fue posible procesar el CSV")}
  finally{setSaving(false)}
 }
 async function openConfig(materialId:string){
  setScreen("config");setConfigId(materialId);setConfigMaterial(null);setConfigLinks({});setLoadingConfig(true);setMessage("");
  try{
   const result=await getMaterialConfiguration(materialId);
   const links:Record<number,{supplier_id?:string;supplier_code?:string}>={};
   for(const link of (result.links||[]) as MaterialLink[]){if(link.priority&&link.priority>=1&&link.priority<=3)links[link.priority]={supplier_id:link.supplier_id,supplier_code:text(link.supplier_code)}}
   setConfigMaterial(result.material);setConfigLinks(links);
  }catch(err:any){setMessage(err?.message||"No fue posible cargar la configuración")}
  finally{setLoadingConfig(false)}
 }
 async function saveConfig(formData:FormData){
  setSaving(true);setMessage("Guardando configuración...");
  try{const result=await updateMaterialConfiguration(formData);setMessage(result.message);router.refresh();setTimeout(()=>back(),250)}
  catch(err:any){setMessage(err?.message||"No fue posible guardar la configuración")}
  finally{setSaving(false)}
 }

 if(screen==="create")return <section className="panel materialCatalog"><div className="materialDedicatedHead"><div><button type="button" className="simpleBack" onClick={back}>← Materiales</button><h2>Nuevo producto</h2><p>Crea la ficha y asigna sus proveedores.</p></div></div>{message&&<p className="note">{message}</p>}<form action={createConfigured} className="adminForm materialForm"><input name="new_family" required placeholder="Familia"/><input name="new_name" required placeholder="Producto"/><input name="new_presentation" placeholder="Presentación"/><input name="new_unit" placeholder="Unidad"/><input name="new_current_net_price" type="number" min="0" step="1" placeholder="Valor neto"/><SupplierFields suppliers={suppliers} prefix="new_"/><div className="dedicatedActions"><button type="button" className="secondary" disabled={saving} onClick={back}>Cancelar</button><button disabled={saving}>{saving?"Guardando…":"Guardar producto y proveedores"}</button></div></form></section>;

 if(screen==="import")return <section className="panel materialCatalog"><div className="materialDedicatedHead"><div><button type="button" className="simpleBack" onClick={back}>← Materiales</button><h2>Actualizar maestro por CSV</h2><p>Valida el archivo completo antes de modificar el Maestro.</p></div></div>{message&&<p className="note">{message}</p>}<form action={importMaster} className="adminForm csvForm"><label>Archivo CSV editado<input name="file" type="file" accept=".csv,text/csv" required disabled={saving}/></label><small>Con material_id válido actualiza esa ficha. Sin material_id crea un producto nuevo. Si un ID o proveedor no se reconoce, el proceso se detiene para revisión.</small><div className="dedicatedActions"><button type="button" className="secondary" disabled={saving} onClick={back}>Cancelar</button><button disabled={saving}>{saving?"Procesando…":"Validar y actualizar maestro"}</button></div></form></section>;

 if(screen==="price"&&editingRow&&editingRow.id){
  const currentPrice=localPrices[editingRow.id]!==undefined?localPrices[editingRow.id]:Number(editingRow.net_value||0);
  return <section className="panel materialCatalog"><div className="materialDedicatedHead"><div><button type="button" className="simpleBack" onClick={back}>← Materiales</button><h2>Editar precio</h2><p>{text(editingRow.product)||"Producto"} · {text(editingRow.presentation)||text(editingRow.unit)||"Sin presentación"}</p></div><span className="catalogCount">{money(currentPrice)}</span></div>{message&&<p className="note">{message}</p>}<form action={savePrice} className="adminForm materialPriceForm"><input type="hidden" name="material_id" value={editingRow.id}/><label>Nuevo valor neto<input name="new_price" type="number" min="0" step="1" required defaultValue={currentPrice}/></label><label>Motivo del cambio<input name="reason" required placeholder="Motivo obligatorio"/></label><div className="dedicatedActions"><button type="button" className="secondary" disabled={saving} onClick={back}>Cancelar</button><button disabled={saving}>{saving?"Guardando…":"Guardar precio"}</button></div></form></section>;
 }

 if(screen==="config"&&configId)return <section className="panel materialCatalog"><div className="materialDedicatedHead"><div><button type="button" className="simpleBack" onClick={back}>← Materiales</button><h2>Configurar material</h2><p>Ficha, presentación, unidad y proveedores en una pantalla independiente.</p></div></div>{message&&<p className="note">{message}</p>}{loadingConfig?<div className="empty"><b>Cargando configuración…</b></div>:configMaterial?<form action={saveConfig} className="adminForm materialForm"><input type="hidden" name="material_id" value={configId}/><input name="family" required defaultValue={text(configMaterial.family)} placeholder="Familia"/><input name="name" required defaultValue={text(configMaterial.name)} placeholder="Producto"/><input name="presentation" defaultValue={text(configMaterial.presentation)} placeholder="Presentación"/><input name="unit" defaultValue={text(configMaterial.unit)} placeholder="Unidad"/><SupplierFields suppliers={suppliers} prefix="" defaults={configLinks}/><div className="dedicatedActions"><button type="button" className="secondary" disabled={saving} onClick={back}>Cancelar</button><button disabled={saving}>{saving?"Guardando…":"Guardar configuración"}</button></div></form>:<div className="empty"><b>No se pudo cargar la ficha</b></div>}</section>;

 return <section className="panel materialCatalog">
  <div className="catalogIntro"><div><h2>Catálogo único de materiales</h2><p>Selecciona una acción; los formularios se abren en una pantalla independiente.</p></div><span className="catalogCount">{filtered.length} de {rows.length} materiales</span></div>
  {sourceCount>rows.length&&<div className="dedupeNotice"><b>{sourceCount-rows.length} repeticiones consolidadas</b><span>Los registros repetidos se agrupan en una sola ficha.</span></div>}
  <div className="masterActions"><button type="button" onClick={()=>setScreen("create")}>+ Nuevo producto</button><button type="button" onClick={()=>setScreen("import")}>Actualizar / cargar CSV</button><a href="/api/materials/export" download>Descargar maestro completo</a><a href="/plantilla-maestro-materiales.csv" download>Plantilla para nuevos</a></div>
  {message&&<p className="note" role="status">{message}</p>}
  <div className="catalogFilters"><label className="catalogSearch">Buscar<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Código, producto o presentación"/></label><label>Familia<select value={family} onChange={e=>setFamily(e.target.value)}><option value="">Todas</option>{families.map(x=><option key={x}>{x}</option>)}</select></label><label>Proveedor<select value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Todos</option>{supplierFilters.map(x=><option key={x}>{x}</option>)}</select></label>{(search||family||supplier)&&<button type="button" className="clearFilters" onClick={()=>{setSearch("");setFamily("");setSupplier("")}}>Limpiar filtros</button>}</div>
  {error?<div className="empty"><b>No fue posible cargar el maestro</b><span>{error}</span></div>:!filtered.length?<div className="empty"><b>Sin coincidencias</b></div>:<div className="catalogTableWrap"><table className="catalogTable"><thead><tr><th>Familia</th><th>Proveedor</th><th>Código</th><th>Producto</th><th>Presentación</th><th>Unidad</th><th className="numeric">Valor neto</th><th className="numeric">Disponibilidad</th><th>Acciones</th></tr></thead><tbody>{filtered.map((r,i)=>{const key=r.id||String(text(r.product))+"-"+i;const currentPrice=r.id&&localPrices[r.id]!==undefined?localPrices[r.id]:Number(r.net_value||0);return <tr key={key}><td>{text(r.family)||"—"}</td><td>{text(r.supplier)||"—"}</td><td className="codeCell">{text(r.supplier_code)||"—"}</td><td><b>{text(r.product)||"Sin nombre"}</b></td><td>{text(r.presentation)||"—"}</td><td>{text(r.unit)||"—"}</td><td className="numeric">{money(currentPrice)}</td><td className={"numeric availability "+(Number(r.availability)>0?"positive":"zero")}>{quantity(r.availability)}</td><td><div className="tableActionGroup">{r.id&&<button type="button" className="linkBtn" onClick={()=>{setEditing(r.id!);setScreen("price");setMessage("")}}>Precio</button>}{r.id&&<button type="button" className="linkBtn" onClick={()=>void openConfig(r.id!)}>Configurar →</button>}</div></td></tr>})}</tbody></table></div>}
 </section>;
}
