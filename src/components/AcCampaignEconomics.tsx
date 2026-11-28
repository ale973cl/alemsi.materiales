"use client";
import {useEffect,useState} from "react";
type Group={contractId:string;contractName:string;active:boolean;start:string;end:string;base:number|null;theoretical:number|null;shortage:number|null;purchaseRequired:number|null;reason:string};
const money=(n:number|null)=>n===null?"—":new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
export default function AcCampaignEconomics({campaignId}:{campaignId:string}){
 const [rows,setRows]=useState<Group[]>([]),[message,setMessage]=useState("Cargando…"),[busy,setBusy]=useState(false);
 const [ranges,setRanges]=useState<Record<string,{start:string;end:string}>>({});
 const load=async()=>{try{const r=await fetch("/api/ac/campaign?campana="+encodeURIComponent(campaignId),{cache:"no-store"});const d=await r.json();if(!r.ok||!d.available)throw Error(d.reason||d.error||"Sin control presupuestario");setRows(d.groups||[]);setRanges(Object.fromEntries((d.groups||[]).map((g:Group)=>[g.contractId,{start:g.start,end:g.end}])));setMessage("")}catch(e:any){setMessage(e.message)}};
 useEffect(()=>{void load()},[campaignId]);
 const save=async(g:Group)=>{const range=ranges[g.contractId];setBusy(true);try{const r=await fetch("/api/ac/campaign",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({campaignId,contractId:g.contractId,...range})});const d=await r.json();if(!r.ok)throw Error(d.error);await load();setMessage(d.message)}catch(e:any){setMessage(e.message)}finally{setBusy(false)}};
 return <div className="acCampaignEconomics">{rows.map(g=><article key={g.contractId}>
  <h4>{g.contractName} · {g.active?"Control activo":"Sin control presupuestario"}</h4>
  <div className="acCampaignCosts"><span>Base 100%<b>{money(g.base)}</b></span><span>Máximo teórico (CPP)<b>{money(g.theoretical)}</b></span><span>Carencia (CPP)<b>{money(g.shortage)}</b></span><span>Compra requerida<b>{money(g.purchaseRequired)}</b></span></div>
  <div className="acConfigGrid"><label>Mes inicial<input type="month" value={ranges[g.contractId]?.start||""} onChange={e=>setRanges(v=>({...v,[g.contractId]:{...v[g.contractId],start:e.target.value}}))}/></label>
  <label>Mes final<input type="month" value={ranges[g.contractId]?.end||""} onChange={e=>setRanges(v=>({...v,[g.contractId]:{...v[g.contractId],end:e.target.value}}))}/></label></div>
  <button type="button" disabled={busy||!ranges[g.contractId]?.start||!ranges[g.contractId]?.end} onClick={()=>void save(g)}>{busy?"Guardando…":"Guardar período económico"}</button>{g.reason&&<p className="acSmallNote">{g.reason}</p>}
 </article>)}{message&&<p role="status">{message}</p>}</div>;
}
