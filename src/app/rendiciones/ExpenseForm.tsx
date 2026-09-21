"use client";
import {useState} from "react";
import {useFormStatus} from "react-dom";
import {addRenditionExpense} from "./actions";

type ReadData={expense_date?:string;document_type?:string;provider_name?:string;provider_rut?:string;document_number?:string;description?:string;presented_amount?:number|null};
const inputStyle={padding:"10px 12px",border:"1px solid #c8dce8",borderRadius:10,fontSize:16,width:"100%"};
function SaveButton(){const {pending}=useFormStatus();return <button disabled={pending} style={{padding:"11px 18px",borderRadius:999,fontWeight:800}}>{pending?"Guardando…":"Guardar gasto"}</button>}

export default function ExpenseForm({renditionId}:{renditionId:string}){
 const [reading,setReading]=useState(false);const [message,setMessage]=useState("");const [preview,setPreview]=useState<string|null>(null);const [data,setData]=useState<ReadData>({document_type:"Boleta"});
 async function readReceipt(file:File){
  setMessage("");
  if(file.type==="application/pdf"){setMessage("El PDF se guardará como respaldo. Para lectura automática usa una foto JPG, PNG o WEBP.");return;}
  setReading(true);
  try{const fd=new FormData();fd.set("file",file);const res=await fetch("/api/rendiciones/leer-comprobante",{method:"POST",body:fd});const json=await res.json();if(!res.ok)throw new Error(json.error||"No se pudo leer el comprobante.");setData(json.data||{});setMessage("Lectura terminada. Revisa y corrige los datos antes de guardar.");}
  catch(e){setMessage(e instanceof Error?e.message:"No se pudo leer. Completa los datos manualmente.");}
  finally{setReading(false);}
 }
 function selected(file?:File){if(!file)return;setPreview(file.type.startsWith("image/")?URL.createObjectURL(file):null);void readReceipt(file);}
 return <form action={addRenditionExpense} encType="multipart/form-data" style={{display:"grid",gap:10}}>
  <input type="hidden" name="rendition_id" value={renditionId}/>
  <div style={{padding:14,border:"2px dashed #79bdb1",borderRadius:14,background:"#f5fbfa"}}><b>1. Foto o comprobante</b><p style={{margin:"5px 0 10px"}}>Toma la foto primero. El sistema intentará completar los datos.</p><input name="document_file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" required onChange={e=>selected(e.target.files?.[0])}/>{preview&&<img src={preview} alt="Vista previa del comprobante" style={{display:"block",maxWidth:260,maxHeight:220,objectFit:"contain",marginTop:10,borderRadius:10}}/>}<div style={{marginTop:8,fontWeight:700}}>{reading?"Analizando comprobante…":message}</div></div>
  <b>2. Revisa los datos detectados</b>
  <label>Fecha<input style={inputStyle} name="expense_date" type="date" required value={data.expense_date||""} onChange={e=>setData({...data,expense_date:e.target.value})}/></label>
  <label>Tipo de documento<select style={inputStyle} name="document_type" value={data.document_type||"Boleta"} onChange={e=>setData({...data,document_type:e.target.value})}>{["Factura","Boleta","Transferencia","Otro","Sin documento"].map(x=><option key={x}>{x}</option>)}</select></label>
  <label>N.º documento<input style={inputStyle} name="document_number" value={data.document_number||""} onChange={e=>setData({...data,document_number:e.target.value})}/></label>
  <label>Proveedor<input style={inputStyle} name="provider_name" value={data.provider_name||""} onChange={e=>setData({...data,provider_name:e.target.value})}/></label>
  <label>RUT proveedor<input style={inputStyle} name="provider_rut" value={data.provider_rut||""} onChange={e=>setData({...data,provider_rut:e.target.value})}/></label>
  <label>Categoría<select style={inputStyle} name="category" required defaultValue=""><option value="" disabled>Seleccionar categoría</option>{["Estacionamiento","Alojamiento","Colación/Alimentación","Compras/Materiales","Insumos varios","Movilización/Uber","Peajes","Otros"].map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Descripción<input style={inputStyle} name="description" required value={data.description||""} onChange={e=>setData({...data,description:e.target.value})}/></label>
  <label>Total pagado<input style={inputStyle} name="presented_amount" type="number" min="1" step="1" required value={data.presented_amount??""} onChange={e=>setData({...data,presented_amount:Number(e.target.value)||null})}/></label>
  <SaveButton/>
 </form>
}
