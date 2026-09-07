"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createPurchaseOrderFromConsolidated} from "@/app/supply-actions";

type Material={id?:string;name?:string|null;family?:string|null;presentation?:string|null;unit?:string|null;supplier_code?:string|null};
type SurveyLine={id?:string;material_id:string;shortage_qty?:number|null;unit_net_price?:number|null;materials?:Material|null};
type SurveyRow={id:string;campaign_id:string;installation_id:string;status:string;confirmed_at?:string|null;campaigns?:{id?:string;label?:string|null;status?:string|null}|null;installations?:{id?:string;name?:string|null;region?:string|null;contracts?:{id?:string;name?:string|null;clients?:{id?:string;legal_name?:string|null}|null}|null}|null;survey_lines?:SurveyLine[]};
type Supplier={id:string;legal_name:string};
type SupplyOrder={id:string;order_number?:string|null;status:string;supply_runs?:{campaign_id?:string|null}|null;purchase_order_lines?:{material_id:string;ordered_qty:number|null}[]};

const campaignName=(label?:string|null)=>{if(!label)return "Campaña";try{const value=JSON.parse(label);return typeof value?.name==="string"?value.name:label}catch{return label}};
const money=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);

export default function ConsolidatedSupplyModule({surveys}:{surveys:SurveyRow[]}){
  const router=useRouter();
  const [campaignId,setCampaignId]=useState("");
  const [view,setView]=useState<"global"|"installation">("global");
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [orders,setOrders]=useState<SupplyOrder[]>([]);
  const [supplierId,setSupplierId]=useState("");
  const [quantities,setQuantities]=useState<Record<string,number>>({});
  const [prices,setPrices]=useState<Record<string,number>>({});
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const loadSupplyContext=async()=>{try{const response=await fetch("/api/supply/context",{cache:"no-store"});const data=await response.json();if(response.ok){setSuppliers(data.suppliers||[]);setOrders(data.orders||[])}}catch{}};
  useEffect(()=>{void loadSupplyContext()},[]);

  const confirmedSurveys=useMemo(()=>surveys.filter(survey=>survey.status==="Confirmada"&&Boolean(survey.confirmed_at)),[surveys]);
  const campaigns=useMemo(()=>{const map=new Map<string,string>();for(const survey of confirmedSurveys){if(survey.campaign_id)map.set(survey.campaign_id,campaignName(survey.campaigns?.label))}return [...map.entries()].map(([id,name])=>({id,name}));},[confirmedSurveys]);
  const filtered=useMemo(()=>campaignId?confirmedSurveys.filter(s=>s.campaign_id===campaignId):confirmedSurveys,[confirmedSurveys,campaignId]);
  const globalRows=useMemo(()=>{const map=new Map<string,any>();for(const survey of filtered){for(const line of survey.survey_lines||[]){const qty=Number(line.shortage_qty||0);if(qty<=0)continue;const current=map.get(line.material_id)||{material_id:line.material_id,material:line.materials,qty:0,unit_net_price:Number(line.unit_net_price||0)};current.qty+=qty;if(!current.unit_net_price)current.unit_net_price=Number(line.unit_net_price||0);map.set(line.material_id,current)}}return [...map.values()].sort((a,b)=>String(a.material?.name||"").localeCompare(String(b.material?.name||""),"es"));},[filtered]);
  const installations=useMemo(()=>{const map=new Map<string,any>();for(const survey of filtered){const shortageLines=(survey.survey_lines||[]).filter(line=>Number(line.shortage_qty||0)>0);const inst=survey.installations;map.set(survey.installation_id,{installation_id:survey.installation_id,name:inst?.name||"Instalación",region:inst?.region||"",client:inst?.contracts?.clients?.legal_name||"Cliente",contract:inst?.contracts?.name||"Contrato",lines:shortageLines})}return [...map.values()].sort((a,b)=>String(a.client).localeCompare(String(b.client),"es")||String(a.name).localeCompare(String(b.name),"es"));},[filtered]);
  const installationsWithNeed=installations.filter(group=>group.lines.length>0);
  const totalQty=globalRows.reduce((sum,row)=>sum+Number(row.qty||0),0);
  const orderedByMaterial=useMemo(()=>{const map=new Map<string,number>();if(!campaignId)return map;for(const order of orders){const run:any=Array.isArray(order.supply_runs)?order.supply_runs[0]:order.supply_runs;if(run?.campaign_id!==campaignId)continue;for(const line of order.purchase_order_lines||[])map.set(line.material_id,Number(map.get(line.material_id)||0)+Number(line.ordered_qty||0))}return map},[orders,campaignId]);
  const orderTotal=globalRows.reduce((sum,row)=>{const qty=Number(quantities[row.material_id]||0);const price=Number(prices[row.material_id]??row.unit_net_price??0);return sum+qty*price},0);

  const createOrder=async()=>{
    setMessage("");
    if(!campaignId){setMessage("Selecciona una campaña específica para generar la OC.");return}
    if(!supplierId){setMessage("Selecciona un proveedor.");return}
    const selections=globalRows.map(row=>({material_id:row.material_id,qty:Number(quantities[row.material_id]||0),unit_net_price:Number(prices[row.material_id]??row.unit_net_price??0)})).filter(item=>item.qty>0);
    if(!selections.length){setMessage("Ingresa al menos una cantidad para comprar.");return}
    const formData=new FormData();formData.set("campaign_id",campaignId);formData.set("supplier_id",supplierId);formData.set("selections",JSON.stringify(selections));
    setSaving(true);
    try{const result=await createPurchaseOrderFromConsolidated(formData);setMessage(`OC ${result.order_number} creada en borrador.`);setQuantities({});await loadSupplyContext();router.refresh()}catch(error:any){setMessage(error?.message||"No se pudo crear la OC")}finally{setSaving(false)}
  };

  return <section className="panel consolidatedModule">
    <div className="catalogIntro"><div><h2>Consolidado de necesidades</h2><p>Solo muestra la diferencia que corresponde pedir de las instalaciones con conteo físico confirmado.</p></div><span className="catalogCount">{filtered.length} instalaciones contabilizadas</span></div>
    <div className="surveyCampaignFilters"><label>Campaña<select value={campaignId} onChange={e=>{setCampaignId(e.target.value);setQuantities({});setMessage("")}}><option value="">Todas las campañas con conteos confirmados</option>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="consolidatedViewSwitch"><button type="button" className={view==="global"?"active":""} onClick={()=>setView("global")}>Consolidado global</button><button type="button" className={view==="installation"?"active":""} onClick={()=>setView("installation")}>Detalle por instalación</button></div></div>
    <div className="campaignMetrics"><span><b>{globalRows.length}</b><small>Productos a pedir</small></span><span><b>{totalQty}</b><small>Unidades a pedir</small></span><span><b>{filtered.length}</b><small>Instalaciones contabilizadas</small></span><span><b>{installationsWithNeed.length}</b><small>Instalaciones que requieren material</small></span></div>
    {view==="global"?<div className="table consolidatedTable">{globalRows.length?globalRows.map(row=><div className="row" key={row.material_id}><span><b>{row.material?.name||"Material"}</b><small>{[row.material?.presentation,row.material?.unit].filter(Boolean).join(" · ")}</small></span><span><small>Cantidad a pedir</small><b>{row.qty}</b></span></div>):<div className="empty"><b>Sin cantidades a pedir</b><span>Las instalaciones contabilizadas no generan carencia en este período.</span></div>}</div>:<div className="consolidatedInstallations">{installations.length?installations.map(group=><article className="campaignCard" key={group.installation_id}><div className="campaignCardHead"><span><b>{group.name}</b><small>{group.client} · {group.contract}{group.region?` · ${group.region}`:""}</small></span><strong>{group.lines.length?"Requiere material":"Sin necesidad"}</strong></div>{group.lines.length?<div className="table">{group.lines.map((line:SurveyLine)=><div className="row" key={line.id||line.material_id}><span><b>{line.materials?.name||"Material"}</b><small>{[line.materials?.presentation,line.materials?.unit].filter(Boolean).join(" · ")}</small></span><span><small>Cantidad a pedir</small><b>{Number(line.shortage_qty||0)}</b></span></div>)}</div>:<div className="empty"><b>Conteo confirmado sin necesidad</b><span>La instalación fue contabilizada y no requiere materiales.</span></div>}</article>):<div className="empty"><b>Sin instalaciones contabilizadas</b></div>}</div>}

    {campaignId&&globalRows.length>0&&<section className="panel" style={{marginTop:16}}><div className="catalogIntro"><div><h3>Generar OC desde este consolidado</h3><p>La OC puede tomar todo o parte de la necesidad y dividirse entre distintos proveedores. El saldo no comprado permanece pendiente.</p></div></div><label>Proveedor<select value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Seleccionar proveedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.legal_name}</option>)}</select></label><div className="table" style={{marginTop:12}}>{globalRows.map(row=>{const ordered=Number(orderedByMaterial.get(row.material_id)||0);const pending=Math.max(Number(row.qty||0)-ordered,0);return <div className="row" key={`oc-${row.material_id}`}><span><b>{row.material?.name||"Material"}</b><small>Necesidad {row.qty} · Ya en OC {ordered} · Pendiente {pending}</small></span><label>Cantidad OC<input type="number" min="0" max={pending} step="any" value={quantities[row.material_id]??""} disabled={pending<=0} onChange={e=>setQuantities(current=>({...current,[row.material_id]:Number(e.target.value)}))}/></label><label>Precio neto<input type="number" min="0" step="any" value={prices[row.material_id]??row.unit_net_price??0} onChange={e=>setPrices(current=>({...current,[row.material_id]:Number(e.target.value)}))}/></label></div>})}</div><div className="campaignCardHead" style={{marginTop:12}}><span><small>Total neto de esta OC</small><b>{money(orderTotal)}</b></span><button type="button" disabled={saving} onClick={createOrder}>{saving?"Generando...":"Crear OC en borrador"}</button></div>{message&&<p className="note"><b>{message}</b></p>}</section>}
    {!campaignId&&view==="global"&&<p className="note">Selecciona una campaña específica para preparar una OC. La vista “Todas” es solo de consulta consolidada.</p>}
    <p className="note"><b>Origen preservado:</b> el consolidado global sirve para comprar. El detalle por instalación queda guardado como base de preparación y de la guía individual de cada instalación.</p>
  </section>;
}
