"use client";
import {useState} from "react";
import {resolvePurchaseOrderMaterial} from "@/app/receipt-actions";
type Missing={id:string;description?:string|null;unit?:string|null;unit_net_price:number;supplier_code?:string|null};
export default function ReceiptUncataloguedMaterials({lines,onDone}:{lines:Missing[];onDone:()=>Promise<void>}){
 const [busy,setBusy]=useState(""),[error,setError]=useState(""),[names,setNames]=useState<Record<string,string>>({}),[families,setFamilies]=useState<Record<string,string>>({}),[units,setUnits]=useState<Record<string,string>>({});
 if(!lines.length)return null;
 const save=async(line:Missing)=>{
  setBusy(line.id);setError("");
  try{await resolvePurchaseOrderMaterial({purchaseOrderLineId:line.id,name:(names[line.id]||line.description||"").trim(),family:(families[line.id]||"Otros").trim(),unit:(units[line.id]||line.unit||"UN").trim(),unitNet:Number(line.unit_net_price||0)});await onDone();}
  catch(e){setError(e instanceof Error?e.message:"No se pudo guardar el material")}
  finally{setBusy("")}
 };
 return <section style={{padding:14,border:"1px solid #e1bc80",borderRadius:11,background:"#fffaf1",margin:"12px 0"}}>
  <h3 style={{margin:"0 0 6px"}}>Productos por incorporar al maestro</h3>
  <p style={{fontSize:13}}>Esta OC contiene líneas sin material vinculado. Identifica cada producto antes de ingresar su factura. Si ya existe un material del mismo nombre y unidad, se reutiliza.</p>
  {lines.map(line=><div key={line.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",alignItems:"end",gap:8,margin:"12px 0"}}>
   <label style={{display:"grid",gap:4,fontSize:12}}>Nombre<input placeholder="Nombre de producto" value={names[line.id]??line.description??""} onChange={e=>setNames(o=>({...o,[line.id]:e.target.value}))}/></label>
   <label style={{display:"grid",gap:4,fontSize:12}}>Familia<input placeholder="Otros" value={families[line.id]??"Otros"} onChange={e=>setFamilies(o=>({...o,[line.id]:e.target.value}))}/></label>
   <label style={{display:"grid",gap:4,fontSize:12}}>Unidad<input placeholder="UN" value={units[line.id]??line.unit??"UN"} onChange={e=>setUnits(o=>({...o,[line.id]:e.target.value}))}/></label>
   <button type="button" disabled={!!busy} onClick={()=>void save(line)}>{busy===line.id?"Guardando…":"Vincular producto"}</button>
  </div>)}
  {error&&<p role="alert" style={{color:"#9c2424"}}>{error}</p>}
  <style jsx>{`@media(max-width:720px){section>div{grid-template-columns:1fr!important}}`}</style>
 </section>;
}
