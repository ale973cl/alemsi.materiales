"use client";
import {useEffect,useState} from "react";
import {createAndResolvePurchaseOrderMaterial,resolvePurchaseOrderMaterial} from "@/app/receipt-actions";

type Missing={id:string;description?:string|null;unit?:string|null;unit_net_price:number;supplier_code?:string|null};
type Catalog={id:string;name:string;presentation?:string|null;unit?:string|null;supplier_code?:string|null};
type Draft={name:string;family:string;presentation:string;unit:string;supplierCode:string};
export default function ReceiptUncataloguedMaterials({lines,onDone}:{lines:Missing[];onDone:()=>Promise<void>}){
 const [catalog,setCatalog]=useState<Catalog[]>([]),[selected,setSelected]=useState<Record<string,string>>({}),[mode,setMode]=useState<Record<string,"existing"|"new">>({}),[drafts,setDrafts]=useState<Record<string,Draft>>({}),[busy,setBusy]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let cancelled=false;fetch("/api/receipts/context",{cache:"no-store"}).then(r=>r.json()).then(data=>{if(!cancelled)setCatalog(data.materials||[])}).catch(()=>{if(!cancelled)setError("No se pudo consultar el Maestro de materiales.")});return()=>{cancelled=true}},[]);
 if(!lines.length)return null;
 const draft=(line:Missing)=>drafts[line.id]||{name:line.description||"",family:"Por clasificar",presentation:"",unit:line.unit||"UN",supplierCode:line.supplier_code||""};
 const setDraft=(line:Missing,patch:Partial<Draft>)=>setDrafts(x=>({...x,[line.id]:{...draft(line),...patch}}));
 const resolve=async(line:Missing)=>{setBusy(line.id);setError("");try{
  if((mode[line.id]||"existing")==="existing"){
   if(!selected[line.id])throw new Error("Selecciona un producto existente o elige Crear nuevo.");
   await resolvePurchaseOrderMaterial({purchaseOrderLineId:line.id,materialId:selected[line.id]});
  }else{
   const d=draft(line);if(!d.name.trim())throw new Error("Indica el nombre del producto.");
   await createAndResolvePurchaseOrderMaterial({purchaseOrderLineId:line.id,name:d.name,family:d.family,presentation:d.presentation,unit:d.unit,supplierCode:d.supplierCode});
  }
  await onDone();
 }catch(e){setError(e instanceof Error?e.message:"No se pudo resolver el producto")}finally{setBusy("")}};
 return <section className="uncataloguedBox">
  <div className="uncataloguedHead"><div><h3>Productos por identificar</h3><p>Antes de ingresar stock, vincula el producto existente o créalo una sola vez en el Maestro.</p></div><b>{lines.length} pendiente{lines.length===1?"":"s"}</b></div>
  {lines.map(line=>{const currentMode=mode[line.id]||"existing",d=draft(line);return <article className="uncataloguedRow" key={line.id}>
   <div className="uncataloguedIdentity"><b>{line.description||"Producto nuevo"}</b><small>{line.supplier_code||"Sin código"} · {line.unit||"UN"} · valor OC {Number(line.unit_net_price||0).toLocaleString("es-CL")}</small></div>
   <div className="miniToggle"><button type="button" className={currentMode==="existing"?"active":""} onClick={()=>setMode(x=>({...x,[line.id]:"existing"}))}>Vincular existente</button><button type="button" className={currentMode==="new"?"active":""} onClick={()=>setMode(x=>({...x,[line.id]:"new"}))}>Crear nuevo</button></div>
   {currentMode==="existing"?<select value={selected[line.id]||""} onChange={e=>setSelected(x=>({...x,[line.id]:e.target.value}))}><option value="">Seleccionar del Maestro</option>{catalog.map(m=><option key={m.id} value={m.id}>{m.name}{m.presentation?" · "+m.presentation:""}{m.supplier_code?" · "+m.supplier_code:""}</option>)}</select>:<div className="newMaterialFields"><input value={d.name} onChange={e=>setDraft(line,{name:e.target.value})} placeholder="Nombre"/><input value={d.family} onChange={e=>setDraft(line,{family:e.target.value})} placeholder="Familia"/><input value={d.presentation} onChange={e=>setDraft(line,{presentation:e.target.value})} placeholder="Presentación"/><input value={d.unit} onChange={e=>setDraft(line,{unit:e.target.value})} placeholder="Unidad"/><input value={d.supplierCode} onChange={e=>setDraft(line,{supplierCode:e.target.value})} placeholder="Código proveedor"/></div>}
   <button type="button" disabled={!!busy||(currentMode==="existing"&&!selected[line.id])} onClick={()=>void resolve(line)}>{busy===line.id?"Guardando…":currentMode==="new"?"Crear y vincular":"Vincular"}</button>
  </article>})}
  {error&&<p role="alert" className="formError">{error}</p>}
 </section>;
}
