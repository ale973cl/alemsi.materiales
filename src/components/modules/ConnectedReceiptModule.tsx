"use client";

import {useEffect,useMemo,useState} from "react";
import {registerPurchaseOrderReceipt} from "@/app/receipt-actions";

type Line={id:string;material_id:string|null;description?:string|null;unit?:string|null;supplier_code?:string|null;ordered_qty:number;unit_net_price:number;already_received:number;pending_qty:number;materials?:{name?:string|null;presentation?:string|null;unit?:string|null;supplier_code?:string|null}|null};
type Order={id:string;order_number?:string|null;status:string;total_net:number;order_type?:string|null;suppliers?:{legal_name?:string|null}|null;purchase_order_lines:Line[]};
type Receipt={id:string;purchase_order_id:string;status:string;received_at?:string|null;shipping_condition?:string|null;freight_net?:number|null};

const money=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);

export default function ConnectedReceiptModule({role}:{role:string}){
  const [orders,setOrders]=useState<Order[]>([]);
  const [receipts,setReceipts]=useState<Receipt[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [qty,setQty]=useState<Record<string,number>>({});
  const [prices,setPrices]=useState<Record<string,number>>({});
  const [shipping,setShipping]=useState("Incluido");
  const [freight,setFreight]=useState(0);
  const [observation,setObservation]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const canReceive=["Admin Total","Admin","Bodega"].includes(role);

  const load=async()=>{
    setLoading(true);
    try{
      const response=await fetch("/api/receipts/context",{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"No se pudo cargar Recepción");
      setOrders(body.orders||[]);setReceipts(body.receipts||[]);
    }catch(error:any){setMessage(error?.message||"No se pudo cargar Recepción")}finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);

  const receivable=useMemo(()=>orders.filter(order=>(order.purchase_order_lines||[]).some(line=>line.material_id&&Number(line.pending_qty)>0)),[orders]);
  const selected=receivable.find(order=>order.id===selectedId)||null;
  const materialLines=(selected?.purchase_order_lines||[]).filter(line=>line.material_id&&Number(line.pending_qty)>0);

  useEffect(()=>{
    if(!selected){setQty({});setPrices({});return}
    const nextQty:Record<string,number>={};const nextPrices:Record<string,number>={};
    for(const line of materialLines){nextQty[line.id]=Number(line.pending_qty||0);nextPrices[line.id]=Number(line.unit_net_price||0)}
    setQty(nextQty);setPrices(nextPrices);setShipping("Incluido");setFreight(0);setObservation("");setMessage("");
  },[selectedId]);

  const submit=async()=>{
    if(!selected)return;
    const lines=materialLines.map(line=>({purchase_order_line_id:line.id,received_qty:Number(qty[line.id]||0),actual_unit_net:Number(prices[line.id]||0)})).filter(line=>line.received_qty>0);
    if(!lines.length){setMessage("Ingresa al menos una cantidad recibida");return}
    if(shipping==="Por pagar"&&freight<=0){setMessage("Ingresa el valor neto del flete por pagar");return}
    const formData=new FormData();
    formData.set("purchase_order_id",selected.id);formData.set("lines",JSON.stringify(lines));formData.set("shipping_condition",shipping);formData.set("freight_net",String(shipping==="Por pagar"?freight:0));formData.set("observation",observation);
    setSaving(true);setMessage("");
    try{
      await registerPurchaseOrderReceipt(formData);
      setMessage("Recepción registrada. Inventario y disponibilidad actualizados.");
      setSelectedId("");await load();
    }catch(error:any){setMessage(error?.message||"No se pudo registrar la recepción")}finally{setSaving(false)}
  };

  return <section className="panel receiptModule">
    <div className="receiptHead"><div><h2>Recepción de materiales</h2><p>Registra lo recibido contra la OC. La recepción actualiza inventario y el último valor neto real del material.</p></div><span className="catalogCount">{receivable.length} OC con saldo</span></div>
    {!canReceive&&<p className="note"><b>Modo consulta.</b> Tu perfil puede revisar recepciones, pero no registrar ingreso físico.</p>}
    {loading?<div className="empty"><b>Cargando recepción…</b></div>:<>
      <div className="receiptSelector"><label>Orden de compra<select value={selectedId} onChange={e=>setSelectedId(e.target.value)} disabled={!canReceive}><option value="">Seleccionar OC con materiales pendientes</option>{receivable.map(order=><option key={order.id} value={order.id}>{order.order_number||"OC sin folio"} · {order.suppliers?.legal_name||"Proveedor"} · {order.status}</option>)}</select></label></div>
      {selected&&<div className="receiptEditor">
        <div className="receiptSummary"><span><small>OC</small><b>{selected.order_number||"Sin folio"}</b></span><span><small>Proveedor</small><b>{selected.suppliers?.legal_name||"Proveedor"}</b></span><span><small>Estado</small><b>{selected.status}</b></span><span><small>Neto OC</small><b>{money(Number(selected.total_net||0))}</b></span></div>
        <div className="receiptTable"><div className="receiptRow receiptHeader"><span>Material</span><span>Pedido</span><span>Recibido</span><span>Pendiente</span><span>Ingreso ahora</span><span>Valor neto unit.</span></div>{materialLines.map(line=>{const name=line.materials?.name||line.description||"Material";return <div className="receiptRow" key={line.id}><span><b>{name}</b><small>{line.materials?.presentation||line.materials?.unit||line.unit||""}</small></span><span>{Number(line.ordered_qty||0)}</span><span>{Number(line.already_received||0)}</span><span><b>{Number(line.pending_qty||0)}</b></span><span><input type="number" min="0" max={Number(line.pending_qty||0)} step="any" value={qty[line.id]??0} onChange={e=>setQty(current=>({...current,[line.id]:Number(e.target.value)}))}/></span><span><input type="number" min="0" step="any" value={prices[line.id]??0} onChange={e=>setPrices(current=>({...current,[line.id]:Number(e.target.value)}))}/></span></div>})}</div>
        <div className="receiptShipping"><label>Condición de envío<select value={shipping} onChange={e=>{setShipping(e.target.value);if(e.target.value!=="Por pagar")setFreight(0)}}><option>Incluido</option><option>Por pagar</option><option>Retiro</option></select></label><label>Flete neto<input type="number" min="0" step="1" value={freight} disabled={shipping!=="Por pagar"} onChange={e=>setFreight(Number(e.target.value))}/><small>{shipping==="Por pagar"?"Obligatorio para incorporar el costo logístico real.":"Solo se registra cuando el despacho viene por pagar."}</small></label><label className="receiptObservation">Observación<textarea rows={3} value={observation} onChange={e=>setObservation(e.target.value)} placeholder="Diferencias, estado de bultos, referencia de transporte, etc."/></label></div>
        {message&&<p className="note"><b>{message}</b></p>}
        <button type="button" onClick={submit} disabled={saving}>{saving?"Registrando…":"Registrar recepción"}</button>
      </div>}
      <div className="receiptHistory"><h3>Últimas recepciones</h3>{receipts.length?receipts.slice(0,12).map(receipt=>{const order=orders.find(o=>o.id===receipt.purchase_order_id);return <div className="receiptHistoryRow" key={receipt.id}><span><b>{order?.order_number||"OC"}</b><small>{order?.suppliers?.legal_name||"Proveedor"}</small></span><span>{receipt.status}</span><span>{receipt.shipping_condition||"Incluido"}</span><strong>{Number(receipt.freight_net||0)>0?`${money(Number(receipt.freight_net))} flete neto`:"Sin flete imputado"}</strong></div>}):<div className="empty"><b>Aún no hay recepciones registradas</b></div>}</div>
    </>}
    <style jsx>{`
      .receiptHead{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.receiptHead h2{margin:0 0 6px}.receiptHead p{margin:0}.receiptSelector{margin:18px 0}.receiptSelector label,.receiptShipping label{display:flex;flex-direction:column;gap:6px;font-weight:700}.receiptSelector select,.receiptShipping select,.receiptShipping input,.receiptShipping textarea,.receiptRow input{width:100%;box-sizing:border-box}.receiptSummary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}.receiptSummary span{border:1px solid #dfe6ea;border-radius:10px;padding:10px;display:flex;flex-direction:column}.receiptSummary small{opacity:.65}.receiptTable{overflow:auto;border:1px solid #dfe6ea;border-radius:12px}.receiptRow{display:grid;grid-template-columns:minmax(240px,2fr) repeat(5,minmax(95px,1fr));gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid #e7ecef;min-width:900px}.receiptRow:last-child{border-bottom:0}.receiptRow>span:first-child{display:flex;flex-direction:column}.receiptHeader{font-weight:800;background:#f4f7f8}.receiptShipping{display:grid;grid-template-columns:1fr 1fr 2fr;gap:12px;margin:18px 0}.receiptShipping small{font-weight:400;opacity:.7}.receiptObservation{grid-column:auto}.receiptHistory{margin-top:26px}.receiptHistoryRow{display:grid;grid-template-columns:2fr 1fr 1fr 1.4fr;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #e7ecef}.receiptHistoryRow span:first-child{display:flex;flex-direction:column}.receiptHistoryRow small{opacity:.65}.receiptHistoryRow strong{text-align:right}@media(max-width:900px){.receiptSummary{grid-template-columns:1fr 1fr}.receiptShipping{grid-template-columns:1fr}.receiptHistoryRow{grid-template-columns:1fr 1fr}.receiptHistoryRow strong{text-align:left}}@media(max-width:600px){.receiptHead{display:block}.receiptSummary{grid-template-columns:1fr}}
    `}</style>
  </section>;
}
