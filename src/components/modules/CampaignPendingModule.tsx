"use client";
import {useMemo,useState} from "react";

type Survey={id:string;campaign_id:string;installation_id:string;confirmed_at?:string|null;campaigns?:{label?:string|null};installations?:{name?:string|null;contracts?:{name?:string|null;clients?:{legal_name?:string|null}}};survey_lines?:{material_id:string;shortage_qty?:number|null;materials?:{name?:string|null;unit?:string|null}}[]};
type Dispatch={id:string;installation_id?:string;observations?:string|null;status:string;created_at?:string;dispatch_lines?:{material_id:string;required_qty:number|string;delivered_qty?:number|string;pending_qty?:number|string}[]};
const name=(label?:string|null)=>{try{return JSON.parse(label||"")?.name||label||"Campaña"}catch{return label||"Campaña"}};
const format=(value?:string|null)=>value?new Date(value).toLocaleDateString("es-CL",{timeZone:"America/Santiago"}):"—";
const n=(v:unknown)=>Math.max(0,Number(v)||0);
const includesCampaign=(d:Dispatch,campaignId:string)=>String(d.observations||"").includes("CAMPAÑA:"+campaignId);
export default function CampaignPendingModule({surveys,dispatches}:{surveys:Survey[];dispatches:Dispatch[]}){
 const [campaign,setCampaign]=useState(""),[search,setSearch]=useState("");
 const choices=useMemo(()=>{const map=new Map<string,string>();for(const s of surveys)map.set(s.campaign_id,name(s.campaigns?.label));return [...map].map(([id,title])=>({id,title}))},[surveys]);
 const rows=useMemo(()=>{
  const filtered=surveys.filter(s=>(!campaign||s.campaign_id===campaign)&&(!search||[s.installations?.name,s.installations?.contracts?.name,s.installations?.contracts?.clients?.legal_name].some(t=>String(t||"").toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")))));
  return filtered.flatMap(s=>(s.survey_lines||[]).filter(l=>n(l.shortage_qty)>0).map(l=>{
   const matching=dispatches.filter(d=>d.status!=="Anulado"&&d.installation_id===s.installation_id&&includesCampaign(d,s.campaign_id));
   const prepared=matching.reduce((t,d)=>t+(d.dispatch_lines||[]).filter(x=>x.material_id===l.material_id).reduce((a,x)=>a+n(x.required_qty),0),0);
   const delivered=matching.reduce((t,d)=>t+(d.dispatch_lines||[]).filter(x=>x.material_id===l.material_id).reduce((a,x)=>a+n(x.delivered_qty),0),0);
   const required=n(l.shortage_qty);
   return {key:s.id+":"+l.material_id,campaign:name(s.campaigns?.label),client:s.installations?.contracts?.clients?.legal_name||"—",contract:s.installations?.contracts?.name||"—",installation:s.installations?.name||"—",material:l.materials?.name||"Material",unit:l.materials?.unit||"",required,generated:prepared,delivered,pendingGuide:Math.max(0,required-prepared),pendingDelivery:Math.max(0,Math.min(required,prepared)-delivered),date:s.confirmed_at,hasGuide:matching.length>0};
  }));
 },[surveys,dispatches,campaign,search]);
 const unassigned=rows.reduce((a,x)=>a+x.pendingGuide,0);
 const awaitingDelivery=rows.reduce((a,x)=>a+x.pendingDelivery,0);
 return <section className="panel" style={{padding:18}}>
  <div className="catalogIntro"><div><h2>Consolidado de preparación y pendientes</h2><p>Necesidades por instalación a partir de levantamientos confirmados. Distingue cantidades aún sin guía y cantidades con guía pendientes de entrega.</p></div></div>
  <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:14}}>
   <label style={{display:"grid",gap:5}}>Campaña<select value={campaign} onChange={e=>setCampaign(e.target.value)}><option value="">Todas las campañas</option>{choices.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
   <label style={{display:"grid",gap:5}}>Buscar instalación o cliente<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre o contrato"/></label>
  </div>
  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14}}>
   <span style={{padding:"10px 12px",background:"#edf5f7",borderRadius:9}}><b>{unassigned}</b> unidades sin guía</span>
   <span style={{padding:"10px 12px",background:"#fff2db",borderRadius:9}}><b>{awaitingDelivery}</b> unidades con guía pendientes de entregar</span>
   <span style={{padding:"10px 12px",background:"#f0f8f2",borderRadius:9}}><b>{rows.length}</b> líneas de requerimiento</span>
  </div>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
   <thead><tr>{["Campaña / instalación","Material","Necesidad","Con guía","Entregado","Sin guía","Pendiente entrega","Fecha toma"].map(x=><th key={x} style={{padding:9,textAlign:"left",borderBottom:"1px solid #dae7ed"}}>{x}</th>)}</tr></thead>
   <tbody>{rows.map(r=><tr key={r.key}>
    <td style={{padding:9,borderBottom:"1px solid #edf3f5"}}><b>{r.installation}</b><small style={{display:"block"}}>{r.campaign} · {r.client} · {r.contract}</small></td>
    <td style={{padding:9,borderBottom:"1px solid #edf3f5"}}>{r.material}{r.unit?" ("+r.unit+")":""}</td>
    {[r.required,r.generated,r.delivered,r.pendingGuide,r.pendingDelivery].map((v,i)=><td key={i} style={{padding:9,borderBottom:"1px solid #edf3f5",fontVariantNumeric:"tabular-nums"}}>{v}</td>)}
    <td style={{padding:9,borderBottom:"1px solid #edf3f5"}}>{format(r.date)}</td>
   </tr>)}</tbody>
  </table></div>
  {!rows.length&&<p>No existen requerimientos confirmados para este filtro.</p>}
  <p style={{fontSize:12,color:"#586f7c",marginTop:14}}>Control de lectura para pruebas: “con guía” usa las cantidades de documentos no anulados vinculados a la campaña, no equivale a preparación física certificada. “Sin guía” indica necesidad todavía sin documento. Las correcciones posteriores al levantamiento o las entregas sin vínculo de campaña requieren revisión específica.</p>
 </section>
}
