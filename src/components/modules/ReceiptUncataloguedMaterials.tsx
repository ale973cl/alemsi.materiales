"use client";
import {useEffect,useState} from "react";
import {resolvePurchaseOrderMaterial} from "@/app/receipt-actions";

type Missing={id:string;description?:string|null;unit?:string|null;unit_net_price:number;supplier_code?:string|null};
type Catalog={id:string;name:string;presentation?:string|null;unit?:string|null};
export default function ReceiptUncataloguedMaterials({lines,onDone}:{lines:Missing[];onDone:()=>Promise<void>}){
 const [catalog,setCatalog]=useState<Catalog[]>([]),[selected,setSelected]=useState<Record<string,string>>({}),[busy,setBusy]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let cancelled=false;fetch("/api/receipts/context",{cache:"no-store"}).then(r=>r.json()).then(data=>{if(!cancelled)setCatalog(data.materials||[])}).catch(()=>{if(!cancelled)setError("No se pudo consultar el Maestro de materiales.")});return()=>{cancelled=true}},[]);
 if(!lines.length)return null;
 const link=async(line:Missing)=>{setBusy(line.id);setError("");try{
  if(!selected[line.id])throw new Error("Selecciona un producto del Maestro.");
  await resolvePurchaseOrderMaterial({purchaseOrderLineId:line.id,materialId:selected[line.id]});
  await onDone();
 }catch(e){setError(e instanceof Error?e.message:"No se pudo vincular")}finally{setBusy("")}};
 return <section style={{padding:14,border:"1px solid #e1bc80",borderRadius:11,background:"#fffaf1",margin:"12px 0"}}>
  <h3 style={{margin:"0 0 6px"}}>Líneas antiguas sin producto vinculado</h3>
  <p style={{fontSize:13}}>Estas OC contienen descripciones sin referencia al Maestro. Identifica el producto existente antes del cotejo. Esta acción nunca crea materiales nuevos.</p>
  {lines.map(line=><div key={line.id} style={{display:"grid",gridTemplateColumns:"minmax(180px,1fr) minmax(220px,2fr) auto",gap:10,alignItems:"end",margin:"10px 0"}}>
   <div><b>{line.description||"Línea sin descripción"}</b><small style={{display:"block"}}>{line.unit||"Unidad no informada"}</small></div>
   <label style={{display:"grid",gap:4,fontSize:12}}>Producto existente<select value={selected[line.id]||""} onChange={e=>setSelected(old=>({...old,[line.id]:e.target.value}))}><option value="">Seleccionar del Maestro</option>{catalog.map(m=><option key={m.id} value={m.id}>{m.name}{m.presentation?" · "+m.presentation:""}</option>)}</select></label>
   <button type="button" disabled={!!busy||!selected[line.id]} onClick={()=>void link(line)}>{busy===line.id?"Vinculando…":"Vincular producto"}</button>
  </div>)}
  {error&&<p role="alert" style={{color:"#9c2424"}}>{error}</p>}
  <style jsx>{`@media(max-width:720px){section>div{grid-template-columns:1fr!important}}`}</style>
 </section>;
}
