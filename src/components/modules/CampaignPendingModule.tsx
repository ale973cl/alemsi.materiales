"use client";
import {useMemo,useState} from "react";
import {coveredCampaignQuantity} from "@/lib/campaign-dispatch-balance";

type Installation={id?:string;name?:string|null;region?:string|null;city?:string|null;commune?:string|null;contracts?:{name?:string|null;clients?:{legal_name?:string|null}}};
type Survey={id:string;campaign_id:string;installation_id:string;confirmed_at?:string|null;campaigns?:{label?:string|null};installations?:Installation;survey_lines?:{material_id:string;shortage_qty?:number|null;materials?:{name?:string|null;unit?:string|null}}[]};
type Dispatch={id:string;installation_id?:string;observations?:string|null;status:string;created_at?:string;dispatch_lines?:{material_id:string;required_qty:number|string;delivered_qty?:number|string;pending_qty?:number|string}[]};
type Metric="required"|"generated"|"delivered"|"pendingGuide"|"pendingDelivery";
const name=(label?:string|null)=>{try{return JSON.parse(label||"")?.name||label||"Campaña"}catch{return label||"Campaña"}};
const n=(v:unknown)=>Math.max(0,Number(v)||0);
const includesCampaign=(d:Dispatch,campaignId:string)=>String(d.observations||"").includes("CAMPAÑA:"+campaignId);
const metricLabel:Record<Metric,string>={required:"Necesidad",generated:"Cubierto / reservado",delivered:"Entregado",pendingGuide:"Sin cubrir",pendingDelivery:"Pendiente entrega"};

export default function CampaignPendingModule({surveys,dispatches}:{surveys:Survey[];dispatches:Dispatch[]}){
 const [campaign,setCampaign]=useState(""),[client,setClient]=useState(""),[installation,setInstallation]=useState(""),[sector,setSector]=useState(""),[metric,setMetric]=useState<Metric>("required");
 const baseRows=useMemo(()=>surveys.flatMap(s=>(s.survey_lines||[]).filter(l=>n(l.shortage_qty)>0).map(l=>{
  const matching=dispatches.filter(d=>d.status!=="Anulado"&&d.installation_id===s.installation_id&&includesCampaign(d,s.campaign_id));
  const generated=matching.reduce((t,d)=>t+(d.dispatch_lines||[]).filter(x=>x.material_id===l.material_id).reduce((a,x)=>a+coveredCampaignQuantity(d.status,x.required_qty,x.delivered_qty),0),0);
  const delivered=matching.reduce((t,d)=>t+(d.dispatch_lines||[]).filter(x=>x.material_id===l.material_id).reduce((a,x)=>a+n(x.delivered_qty),0),0);
  const required=n(l.shortage_qty),i=s.installations,sectorName=i?.region||i?.city||i?.commune||"Sin sector";
  return {key:s.id+":"+l.material_id,campaignId:s.campaign_id,campaign:name(s.campaigns?.label),client:i?.contracts?.clients?.legal_name||"—",installationId:s.installation_id,installation:i?.name||"—",sector:sectorName,materialId:l.material_id,material:l.materials?.name||"Material",unit:l.materials?.unit||"",required,generated,delivered,pendingGuide:Math.max(0,required-generated),pendingDelivery:Math.max(0,Math.min(required,generated)-delivered)};
 })),[surveys,dispatches]);
 const campaigns=useMemo(()=>[...new Map(baseRows.map(r=>[r.campaignId,r.campaign])).entries()].map(([id,label])=>({id,label})),[baseRows]);
 const clients=useMemo(()=>[...new Set(baseRows.map(r=>r.client))].sort(),[baseRows]);
 const sectors=useMemo(()=>[...new Set(baseRows.map(r=>r.sector))].sort(),[baseRows]);
 const filtered=useMemo(()=>baseRows.filter(r=>(!campaign||r.campaignId===campaign)&&(!client||r.client===client)&&(!installation||r.installationId===installation)&&(!sector||r.sector===sector)),[baseRows,campaign,client,installation,sector]);
 const installations=useMemo(()=>[...new Map(filtered.map(r=>[r.installationId,r.installation])).entries()].map(([id,label])=>({id,label})).sort((a,b)=>a.label.localeCompare(b.label,"es")),[filtered]);
 const matrix=useMemo(()=>{const map=new Map<string,any>();for(const r of filtered){const row=map.get(r.materialId)||{id:r.materialId,material:r.material,unit:r.unit,cells:new Map<string,Record<Metric,number>>()};const cell=row.cells.get(r.installationId)||{required:0,generated:0,delivered:0,pendingGuide:0,pendingDelivery:0};(["required","generated","delivered","pendingGuide","pendingDelivery"] as Metric[]).forEach(k=>cell[k]+=r[k]);row.cells.set(r.installationId,cell);map.set(r.materialId,row)}return [...map.values()].sort((a,b)=>a.material.localeCompare(b.material,"es"))},[filtered]);
 const totals=useMemo(()=>filtered.reduce((a,r)=>{(["required","generated","delivered","pendingGuide","pendingDelivery"] as Metric[]).forEach(k=>a[k]+=r[k]);return a},{required:0,generated:0,delivered:0,pendingGuide:0,pendingDelivery:0} as Record<Metric,number>),[filtered]);
 return <section className="panel" style={{padding:18}}>
  <div className="catalogIntro"><div><h2>Consolidado matricial de preparación</h2><p>Una fila por material y una columna por instalación. Las celdas agrupan las líneas equivalentes sin duplicar su presentación.</p></div></div>
  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14}}>
   <label>Cliente<select value={client} onChange={e=>{setClient(e.target.value);setInstallation("")}}><option value="">Todos los clientes</option>{clients.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Campaña<select value={campaign} onChange={e=>setCampaign(e.target.value)}><option value="">Todas las campañas</option>{campaigns.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
   <label>Instalación<select value={installation} onChange={e=>setInstallation(e.target.value)}><option value="">Todas las instalaciones</option>{installations.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
   <label>Sector<select value={sector} onChange={e=>setSector(e.target.value)}><option value="">Todos los sectores</option>{sectors.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Ver cantidades<select value={metric} onChange={e=>setMetric(e.target.value as Metric)}>{(Object.keys(metricLabel) as Metric[]).map(x=><option key={x} value={x}>{metricLabel[x]}</option>)}</select></label>
  </div>
  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14}}>{(["required","generated","delivered","pendingGuide","pendingDelivery"] as Metric[]).map(k=><span key={k} style={{padding:"8px 10px",background:k===metric?"#dff1ed":"#f3f7f8",borderRadius:8}}><small>{metricLabel[k]}</small><br/><b>{totals[k]}</b></span>)}</div>
  <div style={{overflowX:"auto",maxWidth:"100%",border:"1px solid #d6e4e9",borderRadius:10}}><table style={{borderCollapse:"separate",borderSpacing:0,minWidth:Math.max(680,300+installations.length*145),width:"100%",fontSize:13}}>
   <thead><tr><th style={{position:"sticky",left:0,zIndex:3,top:0,minWidth:230,background:"#eef7f8",padding:10,textAlign:"left",borderBottom:"1px solid #c8dce8"}}>Material</th>{installations.map(i=><th key={i.id} style={{position:"sticky",top:0,zIndex:2,minWidth:145,background:"#eef7f8",padding:10,textAlign:"center",borderBottom:"1px solid #c8dce8"}}>{i.label}</th>)}<th style={{position:"sticky",top:0,zIndex:2,minWidth:100,background:"#dff1ed",padding:10,borderBottom:"1px solid #c8dce8"}}>Total</th></tr></thead>
   <tbody>{matrix.map(row=>{const total=installations.reduce((sum,i)=>sum+Number(row.cells.get(i.id)?.[metric]||0),0);return <tr key={row.id}><td style={{position:"sticky",left:0,zIndex:1,background:"white",padding:10,borderBottom:"1px solid #edf3f5"}}><b>{row.material}</b><small style={{display:"block"}}>{row.unit}</small></td>{installations.map(i=><td key={i.id} style={{padding:10,textAlign:"center",fontVariantNumeric:"tabular-nums",borderBottom:"1px solid #edf3f5"}}>{row.cells.get(i.id)?.[metric]||"—"}</td>)}<td style={{padding:10,textAlign:"center",fontWeight:800,background:"#f6fbfa",borderBottom:"1px solid #edf3f5"}}>{total}</td></tr>})}</tbody>
  </table></div>
  {!matrix.length&&<p>No existen requerimientos confirmados para los filtros seleccionados.</p>}
  <p style={{fontSize:12,color:"#586f7c",marginTop:14}}>“Cubierto / reservado” conserva el cálculo operativo actual: guías abiertas y cantidades efectivamente entregadas en guías finalizadas. La matriz solamente cambia la presentación.</p>
 </section>
}
