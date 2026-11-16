"use client";
import {useMemo,useState} from "react";
import InvoiceReader,{type ExtractedInvoice} from "./InvoiceReader";
import {registerReceiptWithoutOrder} from "@/app/receipt-no-oc-actions";

type Supplier={id:string;legal_name:string;rut?:string|null};
type Material={id:string;name:string;presentation?:string|null;unit?:string|null};
type Line={material_id:string;received_qty:number;actual_unit_net:number};
const currency=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
const normalizeRut=(s:string)=>s.toUpperCase().replace(/[^0-9K]/g,"");
export default function ReceiptNoOcPanel({suppliers,materials,onDone}:{suppliers:Supplier[];materials:Material[];onDone:()=>Promise<void>}){
 const [supplierId,setSupplierId]=useState(""),[type,setType]=useState("Factura"),[folio,setFolio]=useState(""),[date,setDate]=useState(""),[net,setNet]=useState(0),[vat,setVat]=useState(0),[total,setTotal]=useState(0);
 const [reason,setReason]=useState(""),[shipping,setShipping]=useState("Incluido"),[freight,setFreight]=useState(0),[notes,setNotes]=useState("");
 const [payment,setPayment]=useState("Sin confirmar"),[days,setDays]=useState(0),[due,setDue]=useState("");
 const [lines,setLines]=useState<Line[]>([{material_id:"",received_qty:1,actual_unit_net:0}]),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
 const supplier=suppliers.find(s=>s.id===supplierId);
 const linesNet=useMemo(()=>lines.reduce((sum,l)=>sum+Math.max(0,l.received_qty)*Math.max(0,l.actual_unit_net),0),[lines]);
 const onExtract=(v:ExtractedInvoice)=>{
  if(v.supplier_rut){const match=suppliers.find(s=>normalizeRut(s.rut||"")===normalizeRut(v.supplier_rut||""));if(match)setSupplierId(match.id)}
  if(v.document_type&&["Factura","Boleta","Guía de despacho","Otro"].includes(v.document_type))setType(v.document_type);
  if(v.folio)setFolio(v.folio);
  if(v.date&&/^\d{4}-\d{2}-\d{2}$/.test(v.date))setDate(v.date);
  if(v.net!=null)setNet(Number(v.net));
  if(v.vat!=null)setVat(Number(v.vat));
  if(v.total!=null)setTotal(Number(v.total));
  if(v.payment_condition){const p=v.payment_condition.toLocaleLowerCase("es-CL");if(p.includes("contado"))setPayment("Contado");else if(p.includes("crédito")||p.includes("credito"))setPayment("Crédito");}
  if(Number.isInteger(v.payment_days)&&Number(v.payment_days)>=0)setDays(Number(v.payment_days));
  setStatus("Datos propuestos por Gemini. Selecciona los productos correspondientes del Maestro y verifica todas las cifras antes de registrar.");
 };
 const patch=(index:number,value:Partial<Line>)=>setLines(old=>old.map((l,i)=>i===index?{...l,...value}:l));
 const submit=async()=>{
  setStatus("");
  if(!supplierId){setStatus("Selecciona un proveedor. Si falta, regístralo primero en el Maestro de Proveedores.");return}
  if(lines.some(l=>!l.material_id)||!lines.length){setStatus("Vincula todos los productos recibidos con el Maestro ALEMSI.");return}
  if(Math.abs(linesNet-net)>1){setStatus(`Neto de productos (${currency(linesNet)}) distinto del neto documento (${currency(net)}). Revisa cantidades y valores.`);return}
  const fd=new FormData();
  const data:Record<string,string>={supplier_id:supplierId,document_type:type,document_folio:folio,document_date:date,document_net:String(net),document_vat:String(vat),document_total:String(total),shipping_condition:shipping,freight_net:String(freight),no_oc_reason:reason,payment_condition:payment,payment_days:String(days),payment_due:due,observation:notes,lines:JSON.stringify(lines)};
  for(const [k,v] of Object.entries(data))fd.set(k,v);
  setBusy(true);
  try{
   const result=await registerReceiptWithoutOrder(fd);
   let documentMsg=file?"":"No se adjuntó documento original.";
   if(file){const upload=new FormData();upload.set("receipt_id",result.id);upload.set("file",file);try{const response=await fetch("/api/receipts/document",{method:"POST",body:upload});const body=await response.json();documentMsg=response.ok?"Factura original guardada.":`Documento no guardado: ${body.error||"Error de almacenamiento"}`;}catch{documentMsg="No se pudo cargar el documento original."}}
   setStatus(`Recepción ${folio} registrada PENDIENTE DE COTEJO. Inventario sin cambios. ${documentMsg}`);
   await onDone();
  }catch(e:any){setStatus(e?.message||"No se pudo registrar la recepción");}
  finally{setBusy(false);}
 };
 return <section className="receiptNoOc" style={{border:"1px solid #c8dce8",borderRadius:12,padding:16,background:"#fff"}}>
  <h3>Recepción sin orden de compra</h3>
  <p>Registra un documento recibido sin OC previa. La compra debe justificarse y quedará pendiente de cotejo. No marca pagos ni carga stock automáticamente.</p>
  <InvoiceReader onExtract={onExtract} onFile={setFile}/>
  <div className="receiptNoOcGrid">
   <label>Proveedor<select value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Seleccionar proveedor existente</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.legal_name}</option>)}</select></label>
   <label>RUT proveedor<input readOnly value={supplier?.rut||""} placeholder="Se carga desde el proveedor seleccionado"/></label>
   <label>Tipo documento<select value={type} onChange={e=>setType(e.target.value)}>{["Factura","Boleta","Guía de despacho","Otro"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Folio<input value={folio} onChange={e=>setFolio(e.target.value)}/></label>
   <label>Fecha documento<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>Neto<input type="number" min="0" value={net} onChange={e=>setNet(Number(e.target.value))}/></label>
   <label>IVA<input type="number" min="0" value={vat} onChange={e=>setVat(Number(e.target.value))}/></label>
   <label>Total<input type="number" min="0" value={total} onChange={e=>setTotal(Number(e.target.value))}/></label>
   <label>Condición de pago<select value={payment} onChange={e=>setPayment(e.target.value)}>{["Sin confirmar","Contado","Crédito"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Plazo (días)<input type="number" min="0" max="365" value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
   <label>Vencimiento<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
   <label>Condición flete<select value={shipping} onChange={e=>setShipping(e.target.value)}>{["Incluido","Por pagar","Retiro"].map(x=><option key={x}>{x}</option>)}</select></label>
   {shipping==="Por pagar"&&<label>Flete neto<input type="number" min="0" value={freight} onChange={e=>setFreight(Number(e.target.value))}/></label>}
  </div>
  <h4>Productos efectivamente recibidos</h4>
  <p style={{fontSize:12}}>La IA no asigna productos del Maestro. Selecciona cada producto y confirma cantidad y precio neto.</p>
  {lines.map((line,index)=><div key={index} className="receiptNoOcLine">
   <label>Material<select value={line.material_id} onChange={e=>patch(index,{material_id:e.target.value})}><option value="">Seleccionar material</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} · {m.presentation||m.unit||""}</option>)}</select></label>
   <label>Cantidad<input type="number" min="0" step="any" value={line.received_qty} onChange={e=>patch(index,{received_qty:Number(e.target.value)})}/></label>
   <label>Neto unitario<input type="number" min="0" step="any" value={line.actual_unit_net} onChange={e=>patch(index,{actual_unit_net:Number(e.target.value)})}/></label>
   <strong>{currency(line.received_qty*line.actual_unit_net)}</strong>
   <button type="button" disabled={lines.length===1} onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))}>Quitar</button>
  </div>)}
  <button type="button" onClick={()=>setLines(old=>[...old,{material_id:"",received_qty:1,actual_unit_net:0}])}>+ Agregar producto</button>
  <p><b>Neto productos:</b> {currency(linesNet)}</p>
  <label className="receiptNoOcFull">Motivo de compra sin OC<textarea required minLength={8} value={reason} onChange={e=>setReason(e.target.value)} rows={2} placeholder="Justificación obligatoria"/></label>
  <label className="receiptNoOcFull">Observaciones<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/></label>
  {status&&<p className="note" role="status">{status}</p>}
  <button type="button" disabled={busy} onClick={()=>void submit()}>{busy?"Registrando…":"Registrar recepción pendiente de cotejo"}</button>
  <style jsx>{`.receiptNoOcGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.receiptNoOcGrid label,.receiptNoOcLine label,.receiptNoOcFull{display:grid;gap:5px;font-weight:700;font-size:12px}.receiptNoOcGrid input,.receiptNoOcGrid select,.receiptNoOcLine input,.receiptNoOcLine select,.receiptNoOcFull textarea{width:100%;min-width:0}.receiptNoOcLine{display:grid;grid-template-columns:minmax(210px,2fr) 110px 125px auto auto;gap:9px;align-items:end;padding:10px 0;border-bottom:1px solid #dce8ef}.receiptNoOcFull{margin:12px 0}@media(max-width:850px){.receiptNoOcGrid{grid-template-columns:1fr 1fr}.receiptNoOcLine{grid-template-columns:1fr 1fr}.receiptNoOcLine label:first-child{grid-column:1/-1}}@media(max-width:550px){.receiptNoOcGrid{grid-template-columns:1fr}}`}</style>
 </section>;
}
