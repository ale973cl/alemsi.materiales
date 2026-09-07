"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {derivePurchaseOrder} from "@/app/actions";
import {createFreePurchaseOrder} from "@/app/supply-actions";

type Supplier={id:string;legal_name:string;rut?:string|null;address?:string|null;purchase_order_email?:string|null;payment_terms?:string|null;conditions?:string|null};
type FreeLine={description:string;qty:number;unit:string;unit_net_price:number;supplier_code:string};
const money=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
const emptyLine=():FreeLine=>({description:"",qty:1,unit:"UN",unit_net_price:0,supplier_code:""});

export default function PurchaseOrdersModule({orders,role}:{orders:any[];role:string}){
  const router=useRouter();
  const canCreate=["Admin Total","Gerencia","Admin"].includes(role);
  const [showFree,setShowFree]=useState(false);
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [supplierId,setSupplierId]=useState("");
  const [lines,setLines]=useState<FreeLine[]>([emptyLine()]);
  const [paymentTerms,setPaymentTerms]=useState("");
  const [deliveryTerms,setDeliveryTerms]=useState("");
  const [billingAddress,setBillingAddress]=useState("");
  const [deliveryAddress,setDeliveryAddress]=useState("");
  const [conditions,setConditions]=useState("");
  const [observations,setObservations]=useState("");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{void(async()=>{try{const response=await fetch("/api/supply/context",{cache:"no-store"});const data=await response.json();if(response.ok)setSuppliers(data.suppliers||[])}catch{}})()},[]);
  const selectedSupplier=useMemo(()=>suppliers.find(item=>item.id===supplierId)||null,[suppliers,supplierId]);
  const net=lines.reduce((sum,line)=>sum+Number(line.qty||0)*Number(line.unit_net_price||0),0);
  const vat=Math.round(net*0.19);
  const total=net+vat;
  const changeSupplier=(id:string)=>{setSupplierId(id);const supplier=suppliers.find(item=>item.id===id);setPaymentTerms(supplier?.payment_terms||"");setConditions(supplier?.conditions||"");if(!deliveryAddress)setDeliveryAddress(supplier?.address||"")};
  const updateLine=(index:number,key:keyof FreeLine,value:string|number)=>setLines(current=>current.map((line,i)=>i===index?{...line,[key]:value}:line));
  const removeLine=(index:number)=>setLines(current=>current.length===1?[emptyLine()]:current.filter((_,i)=>i!==index));
  const submit=async()=>{setMessage("");if(!supplierId){setMessage("Selecciona un proveedor.");return}const valid=lines.filter(line=>line.description.trim()&&Number(line.qty)>0);if(!valid.length){setMessage("Agrega al menos un concepto a la OC.");return}const formData=new FormData();formData.set("supplier_id",supplierId);formData.set("lines",JSON.stringify(valid));formData.set("payment_terms",paymentTerms);formData.set("delivery_terms",deliveryTerms);formData.set("billing_address",billingAddress);formData.set("delivery_address",deliveryAddress);formData.set("conditions",conditions);formData.set("observations",observations);formData.set("vat_rate","19");setSaving(true);try{const result=await createFreePurchaseOrder(formData);setMessage(`OC ${result.order_number} creada en borrador.`);setLines([emptyLine()]);setObservations("");setShowFree(false);router.refresh()}catch(error:any){setMessage(error?.message||"No se pudo crear la OC")}finally{setSaving(false)}};

  return <section className="panel">
    <div className="catalogIntro"><div><h2>Órdenes de compra</h2><p>Las OC de materiales siguen naciendo desde Consolidado y abastecimiento. Aquí también puedes generar compras administrativas o de servicios sin afectar campañas ni inventario.</p></div>{canCreate&&<button type="button" onClick={()=>{setShowFree(value=>!value);setMessage("")}}>{showFree?"Cerrar nueva OC":"+ Nueva OC libre"}</button>}</div>

    {canCreate&&showFree&&<section className="panel" style={{marginTop:16}}>
      <div className="catalogIntro"><div><h3>Nueva OC libre</h3><p>Para software, servicios, arriendos, mantenciones u otras compras que no provienen del consolidado.</p></div><span className="catalogCount">Borrador</span></div>
      <div className="surveyCampaignFilters">
        <label>Proveedor<select value={supplierId} onChange={event=>changeSupplier(event.target.value)}><option value="">Seleccionar proveedor</option>{suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.legal_name}</option>)}</select></label>
        <label>RUT<input value={selectedSupplier?.rut||""} readOnly placeholder="RUT proveedor"/></label>
        <label>Condición de pago<input value={paymentTerms} onChange={event=>setPaymentTerms(event.target.value)} placeholder="Ej. 30 días fecha factura"/></label>
        <label>Condición/plazo de entrega<input value={deliveryTerms} onChange={event=>setDeliveryTerms(event.target.value)} placeholder="Ej. entrega inmediata"/></label>
      </div>
      <div className="surveyCampaignFilters" style={{marginTop:10}}>
        <label>Dirección facturación<input value={billingAddress} onChange={event=>setBillingAddress(event.target.value)} placeholder="Dirección de facturación"/></label>
        <label>Dirección entrega<input value={deliveryAddress} onChange={event=>setDeliveryAddress(event.target.value)} placeholder="Dirección o medio de entrega"/></label>
      </div>
      <div className="table" style={{marginTop:14}}>{lines.map((line,index)=><div className="row" key={index} style={{alignItems:"end"}}><label style={{flex:2}}>Descripción<input value={line.description} onChange={event=>updateLine(index,"description",event.target.value)} placeholder="Software, servicio, licencia, arriendo..."/></label><label>Cantidad<input type="number" min="0.01" step="any" value={line.qty} onChange={event=>updateLine(index,"qty",Number(event.target.value))}/></label><label>Unidad<input value={line.unit} onChange={event=>updateLine(index,"unit",event.target.value)} /></label><label>Precio neto<input type="number" min="0" step="any" value={line.unit_net_price} onChange={event=>updateLine(index,"unit_net_price",Number(event.target.value))}/></label><button type="button" onClick={()=>removeLine(index)}>Quitar</button></div>)}</div>
      <button type="button" className="linkBtn" onClick={()=>setLines(current=>[...current,emptyLine()])}>+ Agregar concepto</button>
      <div className="surveyCampaignFilters" style={{marginTop:14}}><label>Condiciones de la OC<textarea value={conditions} onChange={event=>setConditions(event.target.value)} rows={4} placeholder="Condiciones contractuales, requisitos de facturación, recepción conforme..."/></label><label>Observaciones<textarea value={observations} onChange={event=>setObservations(event.target.value)} rows={4} placeholder="Observaciones internas o para proveedor"/></label></div>
      <div className="campaignMetrics" style={{marginTop:14}}><span><b>{money(net)}</b><small>Neto</small></span><span><b>{money(vat)}</b><small>IVA 19%</small></span><span><b>{money(total)}</b><small>Total</small></span></div>
      <div className="campaignCardHead" style={{marginTop:12}}><span><small>La OC se generará con folio y quedará en estado borrador para revisión.</small></span><button type="button" disabled={saving} onClick={submit}>{saving?"Generando...":"Generar OC libre"}</button></div>
    </section>}

    {message&&<p className="note"><b>{message}</b></p>}
    <div className="table" style={{marginTop:16}}>{orders.length?orders.map(order=><div className="row" key={order.id}><span><b>{order.order_number||"OC sin folio"}</b><small>{order.suppliers?.legal_name||"Proveedor"}</small></span><strong>{money(Number(order.total_net||0))} neto</strong><em>{order.status}</em>{canCreate&&<form action={derivePurchaseOrder}><input type="hidden" name="purchase_order_id" value={order.id}/><button>Derivar OC y pago</button></form>}</div>):<div className="empty"><b>Sin órdenes de compra</b><span>Las nuevas OC aparecerán aquí.</span></div>}</div>
    <p className="note"><b>Abastecimiento:</b> para tomar necesidades confirmadas y convertirlas en OC por proveedor, usa “Consolidado y abastecimiento”. La OC libre no modifica ese saldo.</p>
  </section>;
}
