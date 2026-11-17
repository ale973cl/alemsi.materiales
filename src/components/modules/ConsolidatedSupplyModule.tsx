"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {convertQuotationToPurchaseOrder,createFreePurchaseOrder,createPurchaseOrderFromConsolidated,updateQuotationResponse} from "@/app/supply-actions";

type View="need"|"new"|"documents";
type Material={id:string;name:string;family?:string|null;presentation?:string|null;unit?:string|null;supplier_code?:string|null;current_net_price?:number|null};
type Supplier={id:string;legal_name:string;rut?:string|null;purchase_order_email?:string|null;payment_terms?:string|null;conditions?:string|null};
type OrderLine={id:string;material_id?:string|null;line_type?:string|null;description?:string|null;unit?:string|null;supplier_code?:string|null;ordered_qty:number;unit_net_price:number;line_net:number;committed_qty?:number|null};
type Order={id:string;order_number?:string|null;status:string;total_net:number;total_amount:number;order_type:string;supply_run_id?:string|null;supplier_id:string;payment_terms?:string|null;delivery_terms?:string|null;conditions?:string|null;observations?:string|null;created_at?:string|null;supply_runs?:{campaign_id?:string|null}|null;purchase_order_lines:OrderLine[]};
type SurveyLine={id?:string;material_id:string;shortage_qty?:number|null;unit_net_price?:number|null;materials?:{id?:string;name?:string|null;family?:string|null;presentation?:string|null;unit?:string|null;supplier_code?:string|null}|null};
type SurveyRow={id:string;campaign_id:string;installation_id:string;status:string;campaigns?:{id?:string;label?:string|null}|null;installations?:{name?:string|null;contracts?:{clients?:{legal_name?:string|null}|null}|null}|null;survey_lines?:SurveyLine[]};
type FreeLine={line_type:"Material"|"Producto nuevo"|"Servicio";material_id:string;description:string;qty:number;unit:string;unit_net_price:number;supplier_code:string};

const money=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(n)||0);
const emptyLine=():FreeLine=>({line_type:"Material",material_id:"",description:"",qty:1,unit:"UN",unit_net_price:0,supplier_code:""});
const campaignName=(label?:string|null)=>{if(!label)return"Campaña";try{const j=JSON.parse(label);return j?.name||label}catch{return label}};
const isQuote=(o:Order)=>o.order_type==="Cotización";
const isClosed=(o:Order)=>/cerrad|convertid|anulad|cancelad|recepcionad|finalizad/i.test(o.status||"");

export default function ConsolidatedSupplyModule({surveys,initialView="need"}:{surveys:SurveyRow[];initialView?:View}){
 const router=useRouter();
 const [view,setView]=useState<View>(initialView);
 const [suppliers,setSuppliers]=useState<Supplier[]>([]),[orders,setOrders]=useState<Order[]>([]),[materials,setMaterials]=useState<Material[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const [campaignId,setCampaignId]=useState(""),[supplierId,setSupplierId]=useState(""),[documentKind,setDocumentKind]=useState<"Cotización"|"Orden de compra">("Orden de compra");
 const [selectedQty,setSelectedQty]=useState<Record<string,number>>({}),[selectedPrice,setSelectedPrice]=useState<Record<string,number>>({});
 const [freeLines,setFreeLines]=useState<FreeLine[]>([emptyLine()]),[paymentTerms,setPaymentTerms]=useState(""),[deliveryTerms,setDeliveryTerms]=useState(""),[conditions,setConditions]=useState(""),[observations,setObservations]=useState("");
 const [quoteEdits,setQuoteEdits]=useState<Record<string,{qty:number;price:number;code:string}>>({});
 const [next,setNext]=useState<{kind:"quote"|"order";id:string;number:string}|null>(null);

 const load=async()=>{
  setLoading(true);
  try{
   const res=await fetch("/api/supply/context",{cache:"no-store"}),body=await res.json();
   if(!res.ok)throw new Error(body.error||"No se pudo cargar compras");
   setSuppliers(body.suppliers||[]);setOrders(body.orders||[]);setMaterials(body.materials||[]);
  }catch(e:any){setMessage(e?.message||"No se pudo cargar compras")}finally{setLoading(false)}
 };
 useEffect(()=>{void load()},[]);
 useEffect(()=>{setView(initialView)},[initialView]);

 const campaignOptions=useMemo(()=>{
  const m=new Map<string,{id:string;name:string;client:string}>();
  for(const s of surveys){if(s.status!=="Confirmada")continue;if(!m.has(s.campaign_id))m.set(s.campaign_id,{id:s.campaign_id,name:campaignName(s.campaigns?.label),client:s.installations?.contracts?.clients?.legal_name||""})}
  return [...m.values()];
 },[surveys]);

 const needRows=useMemo(()=>{
  if(!campaignId)return[];
  const m=new Map<string,{material_id:string;name:string;family:string;presentation:string;unit:string;required:number;committed:number;pending:number;price:number}>();
  for(const s of surveys.filter(x=>x.campaign_id===campaignId&&x.status==="Confirmada")){
   for(const l of s.survey_lines||[]){const q=Math.max(0,Number(l.shortage_qty||0));if(!q)continue;const id=l.material_id;const cur=m.get(id)||{material_id:id,name:l.materials?.name||"Material",family:l.materials?.family||"",presentation:l.materials?.presentation||"",unit:l.materials?.unit||"UN",required:0,committed:0,pending:0,price:Number(l.unit_net_price||0)};cur.required+=q;if(!cur.price)cur.price=Number(l.unit_net_price||0);m.set(id,cur)}
  }
  for(const o of orders.filter(o=>o.supply_runs?.campaign_id===campaignId&&!isQuote(o)))for(const l of o.purchase_order_lines||[]){if(!l.material_id)continue;const cur=m.get(l.material_id);if(cur)cur.committed+=Number(l.committed_qty||0)}
  for(const cur of m.values())cur.pending=Math.max(0,cur.required-cur.committed);
  return [...m.values()].sort((a,b)=>a.family.localeCompare(b.family,"es")||a.name.localeCompare(b.name,"es"));
 },[surveys,campaignId,orders]);

 const usePending=()=>{
  const q:Record<string,number>={},p:Record<string,number>={};
  for(const r of needRows){if(r.pending>0){q[r.material_id]=r.pending;p[r.material_id]=r.price}}
  setSelectedQty(q);setSelectedPrice(p);
 };
 const chooseSupplier=(id:string)=>{
  setSupplierId(id);const s=suppliers.find(x=>x.id===id);setPaymentTerms(s?.payment_terms||"");setConditions(s?.conditions||"");
 };
 const createFromNeed=async()=>{
  setMessage("");setNext(null);
  if(!campaignId||!supplierId)return setMessage("Selecciona campaña y proveedor.");
  const selections=needRows.map(r=>({material_id:r.material_id,qty:Number(selectedQty[r.material_id]||0),unit_net_price:Number(selectedPrice[r.material_id]??r.price||0)})).filter(x=>x.qty>0);
  if(!selections.length)return setMessage("Selecciona cantidades para cotizar o comprar.");
  const fd=new FormData();fd.set("campaign_id",campaignId);fd.set("supplier_id",supplierId);fd.set("document_kind",documentKind);fd.set("selections",JSON.stringify(selections));
  setSaving(true);
  try{
   const r=await createPurchaseOrderFromConsolidated(fd);
   setMessage(documentKind==="Cotización"?"Solicitud de cotización creada. La necesidad sigue disponible hasta convertirla en OC.":"Orden de compra creada desde la necesidad consolidada.");
   setNext({kind:documentKind==="Cotización"?"quote":"order",id:r.id,number:r.order_number});
   setSelectedQty({});await load();router.refresh();
  }catch(e:any){setMessage(e?.message||"No se pudo crear el documento")}finally{setSaving(false)}
 };

 const updateFree=(index:number,patch:Partial<FreeLine>)=>setFreeLines(rows=>rows.map((r,i)=>i===index?{...r,...patch}:r));
 const changeFreeType=(index:number,type:FreeLine["line_type"])=>updateFree(index,{...emptyLine(),line_type:type});
 const chooseMaterial=(index:number,id:string)=>{
  const m=materials.find(x=>x.id===id);updateFree(index,{material_id:id,description:m?.name||"",unit:m?.unit||"UN",unit_net_price:Number(m?.current_net_price||0),supplier_code:m?.supplier_code||""});
 };
 const createFree=async()=>{
  setMessage("");setNext(null);
  if(!supplierId)return setMessage("Selecciona proveedor.");
  const valid=freeLines.filter(l=>l.qty>0&&(l.line_type==="Material"?!!l.material_id:!!l.description.trim()));
  if(!valid.length||valid.length!==freeLines.length)return setMessage("Completa cada línea antes de continuar.");
  const fd=new FormData();fd.set("supplier_id",supplierId);fd.set("document_kind",documentKind);fd.set("lines",JSON.stringify(valid));fd.set("payment_terms",paymentTerms);fd.set("delivery_terms",deliveryTerms);fd.set("conditions",conditions);fd.set("observations",observations);fd.set("vat_rate","19");
  setSaving(true);
  try{
   const r=await createFreePurchaseOrder(fd);
   setMessage(documentKind==="Cotización"?"Cotización creada. Puedes registrar la respuesta del proveedor en Documentos.":"Orden de compra creada.");
   setNext({kind:documentKind==="Cotización"?"quote":"order",id:r.id,number:r.order_number});
   setFreeLines([emptyLine()]);setObservations("");await load();router.refresh();
  }catch(e:any){setMessage(e?.message||"No se pudo crear el documento")}finally{setSaving(false)}
 };

 const editQuote=(line:OrderLine,field:"qty"|"price"|"code",value:string|number)=>{
  const cur=quoteEdits[line.id]||{qty:Number(line.ordered_qty||0),price:Number(line.unit_net_price||0),code:line.supplier_code||""};
  setQuoteEdits(x=>({...x,[line.id]:{...cur,[field]:field==="code"?String(value):Number(value)}}));
 };
 const quoteValue=(line:OrderLine,field:"qty"|"price"|"code")=>{
  const e=quoteEdits[line.id];if(e)return e[field];return field==="qty"?Number(line.ordered_qty||0):field==="price"?Number(line.unit_net_price||0):line.supplier_code||"";
 };
 const saveQuote=async(o:Order)=>{
  const fd=new FormData();fd.set("quote_id",o.id);fd.set("lines",JSON.stringify(o.purchase_order_lines.map(l=>({id:l.id,qty:Number(quoteValue(l,"qty")),unit_net_price:Number(quoteValue(l,"price")),supplier_code:String(quoteValue(l,"code"))}))));fd.set("payment_terms",o.payment_terms||"");fd.set("delivery_terms",o.delivery_terms||"");fd.set("conditions",o.conditions||"");
  setSaving(true);setMessage("");
  try{await updateQuotationResponse(fd);setMessage("Respuesta de cotización guardada. Ya puedes convertirla en OC.");await load();router.refresh()}catch(e:any){setMessage(e?.message||"No se pudo guardar la cotización")}finally{setSaving(false)}
 };
 const convertQuote=async(o:Order)=>{
  const fd=new FormData();fd.set("quote_id",o.id);setSaving(true);setMessage("");
  try{const r=await convertQuotationToPurchaseOrder(fd);setMessage("Cotización convertida en "+r.order_number+". No se redigitaron productos ni valores.");setNext({kind:"order",id:r.id,number:r.order_number});await load();router.refresh()}catch(e:any){setMessage(e?.message||"No se pudo convertir la cotización")}finally{setSaving(false)}
 };

 const selectedSupplier=suppliers.find(x=>x.id===supplierId);
 const freeNet=freeLines.reduce((sum,l)=>sum+(Number(l.qty)||0)*(Number(l.unit_net_price)||0),0);
 const quotes=orders.filter(isQuote),purchaseOrders=orders.filter(o=>!isQuote(o));

 return <section className="panel procurement">
  <div className="procureHead">
   <div><p className="eyebrow">ABASTECIMIENTO</p><h2>Compras</h2><p>Necesidad, cotización, orden de compra y recepción conectadas en un mismo circuito.</p></div>
   <nav className="compactTabs"><button className={view==="need"?"active":""} onClick={()=>setView("need")}>Necesidades</button><button className={view==="new"?"active":""} onClick={()=>setView("new")}>Cotizar / comprar</button><button className={view==="documents"?"active":""} onClick={()=>setView("documents")}>Documentos</button></nav>
  </div>
  {message&&<div className="nextBar" role="status"><b>{message}</b></div>}
  {next&&<div className="nextBar nextAction"><span><small>Siguiente acción</small><b>{next.number}</b></span>{next.kind==="quote"?<button type="button" onClick={()=>setView("documents")}>Registrar respuesta / convertir</button>:<a className="btn" href="/?vista=recepcion">Registrar factura y recepción →</a>}<button className="ghostBtn" type="button" onClick={()=>setNext(null)}>Después</button></div>}

  {view==="need"&&<div className="procureSection">
   <div className="compactFields">
    <label>Campaña<select value={campaignId} onChange={e=>{setCampaignId(e.target.value);setSelectedQty({});setSelectedPrice({})}}><option value="">Seleccionar</option>{campaignOptions.map(c=><option key={c.id} value={c.id}>{c.name}{c.client?" · "+c.client:""}</option>)}</select></label>
    <label>Proveedor<select value={supplierId} onChange={e=>chooseSupplier(e.target.value)}><option value="">Seleccionar</option>{suppliers.map(s=><option value={s.id} key={s.id}>{s.legal_name}</option>)}</select></label>
    <label>Documento<select value={documentKind} onChange={e=>setDocumentKind(e.target.value as any)}><option>Cotización</option><option>Orden de compra</option></select></label>
    <button type="button" disabled={!needRows.some(r=>r.pending>0)} onClick={usePending}>Usar todos los pendientes</button>
   </div>
   {!campaignId?<div className="empty compactEmpty"><b>Selecciona una campaña</b><span>Mostraremos solamente las necesidades confirmadas y aún no cubiertas.</span></div>:<div className="compactTable"><div className="compactRow compactHeader"><span>Producto</span><span>Necesidad</span><span>Cubierto</span><span>Pendiente</span><span>Cantidad</span><span>Valor neto</span></div>{needRows.map(r=><div className="compactRow" key={r.material_id}><span><b>{r.name}</b><small>{[r.family,r.presentation,r.unit].filter(Boolean).join(" · ")}</small></span><span>{r.required}</span><span>{r.committed}</span><span><b>{r.pending}</b></span><span><input aria-label={"Cantidad "+r.name} type="number" min="0" max={r.pending} step="any" value={selectedQty[r.material_id]??0} onChange={e=>setSelectedQty(x=>({...x,[r.material_id]:Math.max(0,Math.min(r.pending,Number(e.target.value)||0))}))}/></span><span><input aria-label={"Precio "+r.name} type="number" min="0" step="any" value={selectedPrice[r.material_id]??r.price} onChange={e=>setSelectedPrice(x=>({...x,[r.material_id]:Math.max(0,Number(e.target.value)||0)}))}/></span></div>)}</div>}
   <div className="stickyAction"><span>{selectedSupplier?.legal_name||"Sin proveedor"} · {documentKind}</span><button type="button" disabled={saving||!campaignId||!supplierId} onClick={createFromNeed}>{saving?"Guardando…":documentKind==="Cotización"?"Solicitar cotización":"Generar orden de compra"}</button></div>
  </div>}

  {view==="new"&&<div className="procureSection">
   <div className="compactFields">
    <label>Documento<select value={documentKind} onChange={e=>setDocumentKind(e.target.value as any)}><option>Cotización</option><option>Orden de compra</option></select></label>
    <label className="grow2">Proveedor<select value={supplierId} onChange={e=>chooseSupplier(e.target.value)}><option value="">Seleccionar proveedor</option>{suppliers.map(s=><option value={s.id} key={s.id}>{s.legal_name}{s.rut?" · "+s.rut:""}</option>)}</select></label>
    <label>Pago<input value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} placeholder="30 días"/></label>
    <label>Entrega<input value={deliveryTerms} onChange={e=>setDeliveryTerms(e.target.value)} placeholder="Entrega inmediata"/></label>
   </div>
   <div className="lineEditor">
    <div className="lineEditorHead"><b>Conceptos</b><button type="button" onClick={()=>setFreeLines(x=>[...x,emptyLine()])}>+ Agregar</button></div>
    {freeLines.map((l,i)=><div className="purchaseLine" key={i}>
      <select aria-label="Tipo" value={l.line_type} onChange={e=>changeFreeType(i,e.target.value as FreeLine["line_type"])}><option value="Material">Maestro</option><option value="Producto nuevo">Producto nuevo</option><option value="Servicio">Servicio</option></select>
      {l.line_type==="Material"?<select className="lineDescription" value={l.material_id} onChange={e=>chooseMaterial(i,e.target.value)}><option value="">Buscar / seleccionar producto</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name}{m.presentation?" · "+m.presentation:""}</option>)}</select>:<input className="lineDescription" value={l.description} onChange={e=>updateFree(i,{description:e.target.value})} placeholder={l.line_type==="Producto nuevo"?"Descripción del producto a cotizar":"Descripción del servicio"}/>}
      <input className="lineCode" value={l.supplier_code} onChange={e=>updateFree(i,{supplier_code:e.target.value})} placeholder="Código"/>
      <input className="lineQty" type="number" min=".01" step="any" value={l.qty} onChange={e=>updateFree(i,{qty:Number(e.target.value)})} aria-label="Cantidad"/>
      <input className="lineUnit" value={l.unit} readOnly={l.line_type==="Material"} onChange={e=>updateFree(i,{unit:e.target.value})} aria-label="Unidad"/>
      <input className="linePrice" type="number" min="0" step="any" value={l.unit_net_price} onChange={e=>updateFree(i,{unit_net_price:Number(e.target.value)})} aria-label="Precio neto"/>
      <b className="lineTotal">{money(l.qty*l.unit_net_price)}</b>
      <button type="button" className="removeBtn" aria-label="Quitar línea" onClick={()=>setFreeLines(x=>x.length===1?[emptyLine()]:x.filter((_,ix)=>ix!==i))}>×</button>
    </div>)}
   </div>
   <div className="compactFields">
    <label className="grow2">Condiciones<textarea rows={2} value={conditions} onChange={e=>setConditions(e.target.value)}/></label>
    <label className="grow2">Observaciones<textarea rows={2} value={observations} onChange={e=>setObservations(e.target.value)}/></label>
   </div>
   <div className="stickyAction"><span><b>Neto {money(freeNet)}</b> · Total aprox. {money(freeNet*1.19)}</span><button type="button" disabled={saving||!supplierId} onClick={createFree}>{saving?"Guardando…":documentKind==="Cotización"?"Crear solicitud de cotización":"Crear orden de compra"}</button></div>
  </div>}

  {view==="documents"&&<div className="procureSection">
   {loading?<div className="empty compactEmpty"><b>Cargando documentos…</b></div>:<>
    <div className="documentGroup"><h3>Cotizaciones <span>{quotes.length}</span></h3>{quotes.length?quotes.map(o=><article className="procDocument" key={o.id}><header><span><b>{o.order_number||"Cotización"}</b><small>{suppliers.find(s=>s.id===o.supplier_id)?.legal_name||"Proveedor"} · {o.status}</small></span><strong>{money(o.total_net)}</strong></header>
      {!/convertid|anulad|cancelad/i.test(o.status)&&<div className="quoteLines">{o.purchase_order_lines.map(l=><div className="quoteLine" key={l.id}><span><b>{l.description||materials.find(m=>m.id===l.material_id)?.name||"Producto"}</b><small>{l.line_type||"Material"} · {l.unit||"UN"}</small></span><label>Cant.<input type="number" min=".01" step="any" value={quoteValue(l,"qty")} onChange={e=>editQuote(l,"qty",e.target.value)}/></label><label>Neto<input type="number" min="0" step="any" value={quoteValue(l,"price")} onChange={e=>editQuote(l,"price",e.target.value)}/></label><label>Código<input value={quoteValue(l,"code")} onChange={e=>editQuote(l,"code",e.target.value)}/></label></div>)}</div>}
      <footer>{!/convertid|anulad|cancelad/i.test(o.status)&&<><button disabled={saving} type="button" onClick={()=>saveQuote(o)}>Guardar respuesta</button><button disabled={saving} type="button" onClick={()=>convertQuote(o)}>Convertir a OC</button></>}<small>{o.payment_terms||"Condición de pago pendiente"}{o.delivery_terms?" · "+o.delivery_terms:""}</small></footer>
    </article>):<div className="empty compactEmpty"><b>Sin cotizaciones</b></div>}</div>
    <div className="documentGroup"><h3>Órdenes de compra <span>{purchaseOrders.length}</span></h3>{purchaseOrders.length?purchaseOrders.map(o=><article className="procDocument compactDoc" key={o.id}><header><span><b>{o.order_number||"OC"}</b><small>{suppliers.find(s=>s.id===o.supplier_id)?.legal_name||"Proveedor"} · {o.status}</small></span><strong>{money(o.total_net)}</strong></header><footer><a className="btn" href={"/ordenes-compra/"+o.id}>Ver documento</a>{!isClosed(o)&&<a className="btn" href="/?vista=recepcion">Factura / recepción →</a>}</footer></article>):<div className="empty compactEmpty"><b>Sin órdenes de compra</b></div>}</div>
   </>}
  </div>}
 </section>;
}
