"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {closePurchaseOrderReceipt,registerPurchaseOrderReceipt} from "@/app/receipt-actions";
import {reconcilePurchaseDocument} from "@/app/finance-purchase-actions";
import {isCancelledPurchaseOrder,isClosedPurchaseOrder} from "@/lib/purchase-order-balance";
import ReceiptUncataloguedMaterials from "./ReceiptUncataloguedMaterials";
import ReceiptNoOcPanel from "./ReceiptNoOcPanel";
import InvoiceReader,{type ExtractedInvoice} from "./InvoiceReader";
import {invoiceUnitNet,matchInvoiceLine} from "@/lib/invoice-reconciliation";
type Line={id:string;line_type?:string|null;material_id:string|null;description?:string|null;unit?:string|null;supplier_code?:string|null;ordered_qty:number;unit_net_price:number;already_received:number;pending_qty:number;materials?:{name?:string|null;presentation?:string|null;unit?:string|null;supplier_code?:string|null}|null};
type Order={id:string;order_number?:string|null;status:string;total_net:number;payment_terms?:string|null;order_type?:string|null;suppliers?:{legal_name?:string|null;rut?:string|null}|null;purchase_order_lines:Line[]};
type Receipt={id:string;has_document?:boolean;supplier_id?:string|null;commercial?:{payment_condition?:string;payment_days?:number;payment_due?:string;payment_status?:string;observation?:string}|null;purchase_order_id?:string|null;status:string;received_at?:string|null;shipping_condition?:string|null;freight_net?:number|null;document_type?:string|null;document_folio?:string|null;document_date?:string|null;document_net?:number|null;document_total?:number|null;reconciliation_status?:string|null;inventory_posted?:boolean|null;receipt_lines?:{purchase_order_line_id?:string|null;material_id?:string|null;received_qty?:number|null;actual_unit_net?:number|null;line_net?:number|null}[]};
const money=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
const norm=(v?:string|null)=>(v||"").toLocaleLowerCase("es-CL").trim();
export default function ConnectedReceiptModule({role}:{role:string}){
 const [receiptMode,setReceiptMode]=useState<"oc"|"sin-oc"|"recibidas">("oc"),[suppliers,setSuppliers]=useState<{id:string;legal_name:string;rut?:string|null}[]>([]),[materials,setMaterials]=useState<{id:string;name:string;unit?:string|null;presentation?:string|null}[]>([]),[invoiceFile,setInvoiceFile]=useState<File|null>(null);
 const [orders,setOrders]=useState<Order[]>([]),[receipts,setReceipts]=useState<Receipt[]>([]),[selectedId,setSelectedId]=useState(""),[orderSearch,setOrderSearch]=useState(""),[historySearch,setHistorySearch]=useState("");
 const [qty,setQty]=useState<Record<string,number>>({}),[prices,setPrices]=useState<Record<string,number>>({});
 const [documentType,setDocumentType]=useState("Factura"),[documentFolio,setDocumentFolio]=useState(""),[documentDate,setDocumentDate]=useState(""),[documentNet,setDocumentNet]=useState(0),[documentVat,setDocumentVat]=useState(0),[documentTotal,setDocumentTotal]=useState(0);
 const [shipping,setShipping]=useState("Incluido"),[freight,setFreight]=useState(0),[observation,setObservation]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const [expandedReceipt,setExpandedReceipt]=useState<string>("");
 const [geminiLines,setGeminiLines]=useState<ExtractedInvoice["lines"]>([]);
 const [reconcileId,setReconcileId]=useState(""),[reconcileText,setReconcileText]=useState(""),[reconciling,setReconciling]=useState(false);
 const canReceive=["Admin Total","Admin","Bodega"].includes(role);
 const canReconcile=["Admin Total","Gerencia","Finanzas"].includes(role);
 const load=async()=>{setLoading(true);try{const response=await fetch("/api/receipts/context",{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error||"No se pudo cargar Recepción");setOrders(body.orders||[]);setReceipts(body.receipts||[]);setSuppliers(body.suppliers||[]);setMaterials(body.materials||[])}catch(error:any){setMessage(error?.message||"No se pudo cargar Recepción")}finally{setLoading(false)}};
 useEffect(()=>{void load()},[]);
 const receivable=useMemo(()=>orders.filter(order=>order.order_type!=="Cotización"&&!isClosedPurchaseOrder(order.status)&&!isCancelledPurchaseOrder(order.status)&&(order.purchase_order_lines||[]).some(line=>line.line_type!=="Servicio"&&Number(line.pending_qty)>0)),[orders]);
 const matches=useMemo(()=>{const q=norm(orderSearch);if(!q)return receivable.slice(0,20);return receivable.filter(o=>norm(`${o.order_number} ${o.suppliers?.legal_name} ${o.status}`).includes(q)).slice(0,30)},[receivable,orderSearch]);
 const initialOrderHandled=useRef(false);
 useEffect(()=>{
  if(initialOrderHandled.current||loading||orders.length===0)return;
  const orderId=new URLSearchParams(window.location.search).get("oc");
  if(!orderId){initialOrderHandled.current=true;return}
  const match=receivable.find(order=>order.id===orderId);
  if(match){setReceiptMode("oc");setSelectedId(match.id);setOrderSearch(match.order_number||"");}
  else setMessage("La OC indicada no está disponible para recepción. Revisa si ya fue recibida o cerrada.");
  initialOrderHandled.current=true;
 },[loading,orders.length,receivable]);
 const selected=receivable.find(order=>order.id===selectedId)||null;const materialLines=(selected?.purchase_order_lines||[]).filter(line=>line.material_id&&Number(line.pending_qty)>0);
 const history=useMemo(()=>{const q=norm(historySearch);return receipts.filter(r=>{const o=orders.find(x=>x.id===r.purchase_order_id);return !q||norm(`${r.document_type} ${r.document_folio} ${o?.order_number} ${o?.suppliers?.legal_name}`).includes(q)}).slice(0,100)},[receipts,orders,historySearch]);
 useEffect(()=>{if(!selected){setQty({});setPrices({});return}const q:Record<string,number>={},p:Record<string,number>={};for(const line of materialLines){q[line.id]=Number(line.pending_qty||0);p[line.id]=Number(line.unit_net_price||0)}setQty(q);setPrices(p);setDocumentType("Factura");setDocumentFolio("");setDocumentDate(new Date().toISOString().slice(0,10));const remainingNet=materialLines.reduce((sum,line)=>sum+Number(line.pending_qty||0)*Number(line.unit_net_price||0),0);setDocumentNet(Math.round(remainingNet));setDocumentVat(Math.round(remainingNet*.19));setDocumentTotal(Math.round(remainingNet*1.19));setInvoiceFile(null);setGeminiLines([]);setShipping("Incluido");setFreight(0);setObservation("");setMessage("")},[selectedId]);
 const applyGemini=(data:ExtractedInvoice)=>{
  const invoiceLines=data.lines||[];
  setGeminiLines(invoiceLines);
  if(data.folio)setDocumentFolio(data.folio);
  if(data.date&&/^\d{4}-\d{2}-\d{2}$/.test(data.date))setDocumentDate(data.date);
  if(data.net!=null)setDocumentNet(Number(data.net));
  if(data.vat!=null)setDocumentVat(Number(data.vat));
  if(data.total!=null)setDocumentTotal(Number(data.total));
  if(data.document_type&&["Factura","Boleta","Guía de despacho","Otro"].includes(data.document_type))setDocumentType(data.document_type);

  const nextQty={...qty},nextPrices={...prices};
  const candidates=materialLines.map(line=>({
   id:line.id,
   supplier_code:line.supplier_code||line.materials?.supplier_code||null,
   name:line.materials?.name||line.description||"",
   pending_qty:Number(line.pending_qty||0),
  }));
  const used=new Set<string>();
  let matched=0,unmatched=0,over=0;
  for(const invoiceLine of invoiceLines){
   const found=matchInvoiceLine(invoiceLine,candidates.filter(c=>!used.has(c.id)));
   if(!found.item){unmatched++;continue}
   const quantity=Number(invoiceLine.quantity||0);
   if(quantity>0){
    if(quantity>found.item.pending_qty)over++;
    nextQty[found.item.id]=Math.min(quantity,found.item.pending_qty);
   }
   nextPrices[found.item.id]=invoiceUnitNet(invoiceLine);
   used.add(found.item.id);matched++;
  }
  if(matched){setQty(nextQty);setPrices(nextPrices)}
  const parts=[`Factura leída: ${matched} línea(s) asociada(s) automáticamente.`];
  if(unmatched)parts.push(`${unmatched} línea(s) requieren asociación manual.`);
  if(over)parts.push(`${over} línea(s) superan la cantidad pendiente de la OC; revisa la diferencia.`);
  parts.push("Los netos unitarios se calcularon desde neto de línea ÷ cantidad cuando correspondía.");
  setMessage(parts.join(" "));
 };
 const closeOrder=async(id:string)=>{if(!window.confirm("¿Cerrar esta OC con las cantidades efectivamente recibidas? Los faltantes quedarán disponibles para una nueva orden."))return;setSaving(true);setMessage("");try{const r=await closePurchaseOrderReceipt(id);setMessage(`OC ${r.status}. Recibido: ${r.totalReceived}. No entregado: ${r.outstanding}.`);await load()}catch(e:any){setMessage(e?.message||"No se pudo cerrar la OC")}finally{setSaving(false)}};
 const reconcileReceipt=async(id:string)=>{if(reconcileText.trim().toUpperCase()!=="CONFIRMAR"){setMessage("Escribe CONFIRMAR para validar el cotejo");return}setReconciling(true);setMessage("");try{const formData=new FormData();formData.set("receipt_id",id);formData.set("confirmation","CONFIRMAR");const r=await reconcilePurchaseDocument(formData);setMessage(`Cotejo ${r.status}. Inventario actualizado.`);setReconcileId("");setReconcileText("");await load()}catch(e:any){setMessage(e?.message||"No se pudo cotejar el documento")}finally{setReconciling(false)}};
 const submit=async()=>{if(!selected)return;const lines=materialLines.map(line=>({purchase_order_line_id:line.id,material_id:line.material_id,received_qty:Number(qty[line.id]||0),actual_unit_net:Number(prices[line.id]||0)})).filter(line=>line.received_qty>0);if(!documentFolio.trim()){setMessage("Ingresa el folio del documento");return}if(!documentDate){setMessage("Ingresa la fecha del documento");return}if(!lines.length){setMessage("Ingresa al menos una cantidad recibida");return}if(lines.some(line=>!Number.isFinite(line.received_qty)||line.received_qty<=0||line.received_qty>Number(materialLines.find(m=>m.id===line.purchase_order_line_id)?.pending_qty||0)||!Number.isFinite(line.actual_unit_net)||line.actual_unit_net<0)){setMessage("Revisa las cantidades y precios: no puedes recibir más que el saldo pendiente de la OC.");return}if(![documentNet,documentVat,documentTotal].every(value=>Number.isFinite(value)&&value>=0)||Math.abs(documentNet+documentVat-documentTotal)>1){setMessage("El neto más IVA debe coincidir con el total del documento.");return}if(shipping==="Por pagar"&&freight<=0){setMessage("Ingresa el valor neto del flete por pagar");return}const formData=new FormData();formData.set("purchase_order_id",selected.id);formData.set("lines",JSON.stringify(lines));formData.set("document_type",documentType);formData.set("document_folio",documentFolio);formData.set("document_date",documentDate);formData.set("document_net",String(documentNet));formData.set("document_vat",String(documentVat));formData.set("document_total",String(documentTotal));formData.set("shipping_condition",shipping);formData.set("freight_net",String(shipping==="Por pagar"?freight:0));formData.set("observation",observation);setSaving(true);setMessage("");try{const result=await registerPurchaseOrderReceipt(formData);let uploadMessage="";if(invoiceFile){const upload=new FormData();upload.set("receipt_id",result.id);upload.set("file",invoiceFile);try{const response=await fetch("/api/receipts/document",{method:"POST",body:upload});const body=await response.json();uploadMessage=response.ok?" Factura original guardada.":` Archivo sin guardar: ${body.error||"fallo de almacenamiento"}.`;}catch{uploadMessage=" Archivo original sin guardar."}}setMessage("Documento registrado y asociado a la OC; queda pendiente de cotejo."+uploadMessage);setSelectedId("");setOrderSearch("");setReceiptMode("recibidas");await load()}catch(error:any){setMessage(error?.message||"No se pudo registrar la recepción")}finally{setSaving(false)}};

 const focusedReceiptId=reconcileId||expandedReceipt;
 const focusedReceipt=focusedReceiptId?receipts.find(r=>r.id===focusedReceiptId)||null:null;
 const focusedOrder=focusedReceipt?orders.find(o=>o.id===focusedReceipt.purchase_order_id)||null:null;

 if(selected){
  return <section className="panel receiptModule receiptDedicatedPage">
   <div className="receiptDedicatedHead"><div><button type="button" className="simpleBack" onClick={()=>{setSelectedId("");setOrderSearch("");setMessage("")}}>← Órdenes pendientes</button><h2>Registrar recepción</h2><p>{selected.order_number||"OC sin folio"} · {selected.suppliers?.legal_name||"Proveedor"}</p></div><span className="catalogCount">{selected.status}</span></div>
   <div className="receiptSummary"><span><small>OC</small><b>{selected.order_number||"Sin folio"}</b></span><span><small>Proveedor / RUT</small><b>{selected.suppliers?.legal_name||"Proveedor"}</b><small>{selected.suppliers?.rut||"RUT pendiente"}</small></span><span><small>Estado</small><b>{selected.status}</b></span><span><small>Neto OC</small><b>{money(Number(selected.total_net||0))}</b><small>Pago: {selected.payment_terms||"No informado"}</small></span></div>
   <ReceiptUncataloguedMaterials lines={(selected.purchase_order_lines||[]).filter(line=>line.line_type!=="Servicio"&&!line.material_id&&Number(line.pending_qty)>0)} onDone={load}/>
   <InvoiceReader onExtract={applyGemini} onFile={setInvoiceFile}/>
   <div className="receiptDocument"><label>Tipo de documento<select value={documentType} onChange={e=>setDocumentType(e.target.value)}><option>Factura</option><option>Boleta</option><option>Guía de despacho</option><option>Otro</option></select></label><label>Folio documento<input value={documentFolio} onChange={e=>setDocumentFolio(e.target.value)} placeholder="Folio obligatorio"/></label><label>Fecha documento<input type="date" value={documentDate} onChange={e=>setDocumentDate(e.target.value)}/></label><label>Neto documento<input type="number" min="0" value={documentNet} onChange={e=>setDocumentNet(Number(e.target.value))}/></label><label>IVA<input type="number" min="0" value={documentVat} onChange={e=>setDocumentVat(Number(e.target.value))}/></label><label>Total documento<input type="number" min="0" value={documentTotal} onChange={e=>setDocumentTotal(Number(e.target.value))}/></label></div>
   {!!geminiLines?.length&&<section className="receiptExtracted"><h4>Comparar factura leída con materiales solicitados</h4><p>Las coincidencias seguras completan cantidad y neto unitario. Revisa únicamente asociaciones y diferencias antes de registrar.</p><div className="receiptRecordedTable"><table><thead><tr><th>Descripción factura</th><th>Cantidad</th><th>Neto línea</th><th>Neto unitario calculado</th><th>Revisión</th></tr></thead><tbody>{geminiLines.map((l,i)=><tr key={i}><td>{l.description}</td><td>{l.quantity??"—"}</td><td>{l.line_net??"—"}</td><td>{invoiceUnitNet(l)||"—"}</td><td>{materialLines.some(m=>String(m.materials?.name||m.description||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-CL").trim()===String(l.description||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-CL").trim())?"Coincidencia de nombre; verificar código y cantidad":"Revisar correspondencia manual"}</td></tr>)}</tbody></table></div></section>}
   <div className="receiptTable"><div className="receiptRow receiptHeader"><span>Material</span><span>Pedido</span><span>Recibido</span><span>Pendiente</span><span>Ingreso ahora</span><span>Valor neto unit.</span></div>{materialLines.map(line=>{const name=line.materials?.name||line.description||"Material";return <div className="receiptRow" key={line.id}><span><b>{name}</b><small>{line.materials?.presentation||line.materials?.unit||line.unit||""}</small></span><span>{Number(line.ordered_qty||0)}</span><span>{Number(line.already_received||0)}</span><span><b>{Number(line.pending_qty||0)}</b></span><span><input type="number" min="0" max={Number(line.pending_qty||0)} step="any" value={qty[line.id]??0} onChange={e=>setQty(current=>({...current,[line.id]:Number(e.target.value)}))}/></span><span><input type="number" min="0" step="any" value={prices[line.id]??0} onChange={e=>setPrices(current=>({...current,[line.id]:Number(e.target.value)}))}/></span></div>})}</div>
   <div className="receiptShipping"><label>Condición de envío<select value={shipping} onChange={e=>{setShipping(e.target.value);if(e.target.value!=="Por pagar")setFreight(0)}}><option>Incluido</option><option>Por pagar</option><option>Retiro</option></select></label><label>Flete neto<input type="number" min="0" step="1" value={freight} disabled={shipping!=="Por pagar"} onChange={e=>setFreight(Number(e.target.value))}/></label><label className="receiptObservation">Observación<textarea rows={3} value={observation} onChange={e=>setObservation(e.target.value)} placeholder="Diferencias, estado de bultos, referencia de transporte, etc."/></label></div>
   {message&&<p className="note"><b>{message}</b></p>}
   <div className="receiptDedicatedActions"><button type="button" className="secondary" disabled={saving} onClick={()=>setSelectedId("")}>Cancelar</button><button type="button" onClick={submit} disabled={saving}>{saving?"Registrando…":"Registrar recepción y enviar a cotejo"}</button></div>
  </section>;
 }

 if(focusedReceipt){
  return <section className="panel receiptModule receiptDedicatedPage">
   <div className="receiptDedicatedHead"><div><button type="button" className="simpleBack" onClick={()=>{setExpandedReceipt("");setReconcileId("");setReconcileText("");setMessage("")}}>← Recepciones</button><h2>{focusedReceipt.document_type||"Documento"} {focusedReceipt.document_folio||"sin folio"}</h2><p>{focusedOrder?.order_number||"Sin OC"} · {focusedOrder?.suppliers?.legal_name||suppliers.find(x=>x.id===focusedReceipt.supplier_id)?.legal_name||"Proveedor"}</p></div><span className="catalogCount">{focusedReceipt.reconciliation_status||focusedReceipt.status}</span></div>
   {message&&<p className="note"><b>{message}</b></p>}
   <div className="receiptSummary"><span><small>Fecha</small><b>{focusedReceipt.document_date||"No informada"}</b></span><span><small>Neto</small><b>{money(Number(focusedReceipt.document_net||0))}</b></span><span><small>Total</small><b>{money(Number(focusedReceipt.document_total||0))}</b></span><span><small>Envío</small><b>{focusedReceipt.shipping_condition||"Incluido"}</b></span></div>
   <div className="receiptRecordedTable"><table><thead><tr><th>Producto registrado</th><th>Cantidad recibida</th><th>Neto unitario</th><th>Neto línea</th></tr></thead><tbody>{(focusedReceipt.receipt_lines||[]).map((line,index)=>{const poLine=(focusedOrder?.purchase_order_lines||[]).find(item=>item.id===line.purchase_order_line_id);return <tr key={line.purchase_order_line_id||String(index)}><td>{poLine?.materials?.name||poLine?.description||"Producto sin identificación disponible"}</td><td>{Number(line.received_qty||0)}</td><td>{money(Number(line.actual_unit_net||0))}</td><td>{money(Number(line.line_net||0))}</td></tr>})}</tbody></table></div>
   {!(focusedReceipt.receipt_lines||[]).length&&<div className="empty"><b>Sin líneas registradas</b></div>}
   {focusedReceipt.has_document&&<div className="receiptDedicatedActions"><a className="btn" href={"/api/receipts/document?receipt_id="+focusedReceipt.id} target="_blank" rel="noopener noreferrer">Ver documento original</a></div>}
   {reconcileId===focusedReceipt.id&&!focusedReceipt.inventory_posted&&canReconcile&&<div className="receiptReconcilePage"><h3>Cotejar y cargar inventario</h3><p>Revisa el documento y las cantidades. Al confirmar se cargará inventario y se cerrará la OC completa o incompleta.</p><label>Confirmación<input value={reconcileText} onChange={e=>setReconcileText(e.target.value)} placeholder="Escribe CONFIRMAR"/></label><div className="receiptDedicatedActions"><button type="button" className="secondary" disabled={reconciling} onClick={()=>{setReconcileId("");setReconcileText("")}}>Cancelar</button><button type="button" disabled={reconciling||reconcileText.trim().toUpperCase()!=="CONFIRMAR"} onClick={()=>void reconcileReceipt(focusedReceipt.id)}>{reconciling?"Cotejando…":"Confirmar cotejo"}</button></div></div>}
   {expandedReceipt===focusedReceipt.id&&!focusedReceipt.inventory_posted&&canReconcile&&<div className="receiptDedicatedActions"><button type="button" onClick={()=>{setExpandedReceipt("");setReconcileId(focusedReceipt.id);setReconcileText("")}}>Cotejar y cargar stock →</button></div>}
  </section>;
 }
 if(receiptMode==="sin-oc"){
  return <section className="panel receiptModule receiptDedicatedPage">
   <div className="receiptDedicatedHead"><div><button type="button" className="simpleBack" onClick={()=>{setReceiptMode("oc");setMessage("")}}>← Recepción con OC</button><h2>Recepción sin OC</h2><p>Registra una compra excepcional sin orden de compra y deja la justificación trazada.</p></div></div>
   {message&&<p className="note"><b>{message}</b></p>}
   {canReceive?<ReceiptNoOcPanel suppliers={suppliers} materials={materials} role={role} onDone={async()=>{await load();setReceiptMode("recibidas")}}/>:<p className="note">Sin permisos para recepción.</p>}
  </section>;
 }

 if(receiptMode==="recibidas"){
  return <section className="panel receiptModule receiptDedicatedPage">
   <div className="receiptDedicatedHead"><div><button type="button" className="simpleBack" onClick={()=>setReceiptMode("oc")}>← Recepción</button><h2>Facturas y compras recepcionadas</h2><p>Documentos asociados a OC y compras excepcionales sin OC, con estado de cotejo e inventario.</p></div><span className="catalogCount">{receipts.length} documentos</span></div>
   {message&&<p className="note"><b>{message}</b></p>}
   <div className="receiptHistoryHead"><input value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Buscar factura, OC o proveedor"/></div>
   <div className="receivedInvoiceList">{history.length?history.map(receipt=>{const order=orders.find(o=>o.id===receipt.purchase_order_id),supplierName=order?.suppliers?.legal_name||suppliers.find(x=>x.id===receipt.supplier_id)?.legal_name||"Proveedor";return <article className="receivedInvoiceRow" key={receipt.id}><span><b>{receipt.document_type||"Documento"} {receipt.document_folio||"sin folio"}</b><small>{supplierName}</small></span><span><small>Orden asociada</small><b>{order?.order_number||"Sin OC"}</b></span><span><small>Fecha</small><b>{receipt.document_date||"—"}</b></span><span><small>Neto</small><b>{money(Number(receipt.document_net||0))}</b></span><span><small>Estado</small><b>{receipt.reconciliation_status||receipt.status}</b></span><div className="receiptActions">{!receipt.inventory_posted&&canReconcile&&<button type="button" onClick={()=>{setReconcileId(receipt.id);setReconcileText("")}}>Cotejar →</button>}{receipt.has_document&&<a className="btn" href={"/api/receipts/document?receipt_id="+receipt.id} target="_blank" rel="noopener noreferrer">Original</a>}<button type="button" onClick={()=>setExpandedReceipt(receipt.id)}>Detalle →</button></div></article>}):<div className="empty"><b>{historySearch?"Sin coincidencias":"Aún no hay documentos recepcionados"}</b></div>}</div>
  </section>;
 }


 return <section className="panel receiptModule">
  <div className="receiptHead"><div><h2>Recepción de materiales</h2><p>Selecciona una orden o un documento para abrir su proceso en una pantalla independiente.</p></div><span className="catalogCount">{receivable.length} OC con saldo</span></div>
  {!canReceive&&<p className="note"><b>Modo consulta.</b> Tu perfil puede revisar recepciones, pero no registrar ingreso físico.</p>}
  <div className="receiptModeActions"><button type="button" className="active">OC pendientes</button>{canReceive&&<button type="button" onClick={()=>setReceiptMode("sin-oc")}>Recepción sin OC →</button>}<button type="button" onClick={()=>setReceiptMode("recibidas")}>Facturas recepcionadas →</button></div>
  {message&&<p className="note"><b>{message}</b></p>}
  {loading?<div className="empty"><b>Cargando recepción…</b></div>:<>
   <div className="receiptSelector">
    <label>Buscar orden de compra<input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="N° de OC, proveedor o estado" disabled={!canReceive}/></label>
    {canReceive&&orderSearch.trim()&&<div className="receiptMatches">{matches.length?matches.map(order=><button type="button" key={order.id} onClick={()=>{setSelectedId(order.id);setOrderSearch(order.order_number||"")}}><b>{order.order_number||"OC sin folio"}</b><span>{order.suppliers?.legal_name||"Proveedor"}</span><small>{order.status} · {money(Number(order.total_net||0))}</small><strong>Abrir →</strong></button>):<span className="receiptNoMatch">No se encontraron OC con materiales pendientes.</span>}</div>}
    {!orderSearch.trim()&&canReceive&&<small className="receiptHelp">Escribe la OC impresa en la factura o busca por proveedor.</small>}
   </div>
  </>}
 </section>;
}
