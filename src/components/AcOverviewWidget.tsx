"use client";
import {useEffect,useMemo,useState} from "react";
type Guide={id:string;guide:string;month:string;net:number;kind:string;status:string};
type Contract={id:string;clientName:string;name:string;active:boolean;cycle:string;nextCycle:string|null;budget:number|null;spent:number|null;percent:number|null;remaining:number|null;status:string;curve:{month:string;budget:number;spent:number;returns:number}[];guides:Guide[];campaignCost:number|null};
type Overview={available:boolean;reason?:string;contracts:Contract[];kpi:{optimal:number;alert:number;excess:number;upcoming:number;withoutControl:number;invoicesDue:number;invoicesLate:number}};
const clp=(n:number|null)=>n===null?"—":new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
const pct=(n:number|null)=>n===null?"—":new Intl.NumberFormat("es-CL",{maximumFractionDigits:1}).format(n)+"%";
export default function AcOverviewWidget(){
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(""),[filter,setFilter]=useState("todos"),[open,setOpen]=useState<string|null>(null),[showRows,setShowRows]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch("/api/ac/overview",{cache:"no-store",signal:controller.signal})
  .then(async r=>{if(!r.ok)throw new Error("No se pudo consultar el resumen económico");return r.json()})
  .then(setData).catch(e=>{if(e.name!=="AbortError")setError(e.message)});return()=>controller.abort()},[]);
 const contracts=useMemo(()=>data?.contracts.filter(c=>filter==="todos"||c.status===filter)||[],[data,filter]);
 const selected=contracts.find(c=>c.id===open)||data?.contracts.find(c=>c.id===open);
 if(error)return <section className="acOverview" aria-label="Control económico"><h3>Control económico de materiales</h3><p role="status">{error}. La operación de materiales no se ve afectada.</p></section>;
 if(!data)return <section className="acOverview" aria-label="Control económico"><h3>Control económico de materiales</h3><p role="status">Cargando resumen…</p></section>;
 if(!data.available)return <section className="acOverview" aria-label="Control económico"><h3>Control económico de materiales</h3><p>{data.reason||"Sin control presupuestario"}.</p></section>;
 const cards=[["optimo","Contratos óptimos",data.kpi.optimal],["alerta","En alerta >80%",data.kpi.alert],["exceso","En exceso >100%",data.kpi.excess],["proximos","Próximos ciclos",data.kpi.upcoming]] as const;
 return <section className="acOverview" aria-label="Control económico por contrato">
  <div className="acOverviewHead"><h3>Control económico de materiales</h3><a href="/?vista=presupuesto">Informe completo</a></div>
  <div className="acFourKpis">{cards.map(([key,title,value])=><button type="button" key={key} className={filter===key?"selected":""} onClick={()=>{setFilter(old=>old===key?"todos":key==="proximos"?"todos":key);setShowRows(true)}}><span>{title}</span><strong>{value}</strong></button>)}</div>
  <p className="acSmallNote">{data.kpi.withoutControl} contrato(s) sin control presupuestario · Facturas por vencer: {data.kpi.invoicesDue} · Vencidas: {data.kpi.invoicesLate}. Fechas de ciclos referenciales, no promesas de entrega.</p>
  <button className="acToggleRows" type="button" aria-expanded={showRows} onClick={()=>setShowRows(s=>!s)}>{showRows?"Ocultar contratos":"Ver contratos y guías"}</button>
  {showRows&&<div className="acOverviewTable"><table><thead><tr><th>Cliente / Contrato</th><th>Ciclo</th><th>Próximo ciclo</th><th>Base 100%</th><th>Costo campaña</th><th>Guías neto</th><th>% Ocupado</th><th>Saldo CLP</th><th>% Remanente</th><th>Estado</th></tr></thead><tbody>{contracts.map(c=><tr key={c.id}><td><button type="button" className="acContractOpen" onClick={()=>setOpen(c.id)}>{c.clientName}<small>{c.name}</small></button></td><td>{c.cycle}</td><td>{c.nextCycle||"Sin programar"}</td><td>{clp(c.budget)}</td><td>{clp(c.campaignCost)}</td><td>{clp(c.spent)}</td><td>{pct(c.percent)}</td><td>{clp(c.remaining)}</td><td>{pct(c.percent===null?null:100-c.percent)}</td><td>{c.status==="sin_control"?"Sin control presupuestario":c.status==="sin_base"?"Sin base 100%":c.status==="exceso"?"Exceso":c.status==="alerta"?"Alerta":"Óptimo"}</td></tr>)}</tbody></table></div>}
  {selected&&<div className="acDrawerBackdrop" role="presentation" onClick={()=>setOpen(null)}><aside className="acDrawer" role="dialog" aria-modal="true" aria-label={"Detalle económico de "+selected.name} onClick={e=>e.stopPropagation()}>
   <div className="acDrawerHeader"><div><h3>{selected.name}</h3><p>{selected.clientName}</p></div><button type="button" onClick={()=>setOpen(null)} aria-label="Cerrar detalle">Cerrar</button></div>
   <p className="acSmallNote">Consumo por guía emitida. Compras y recepciones se controlan por separado.</p>
   <h4>Curva mensual</h4><div className="acCurve">{selected.curve.map(m=><div className="acCurveRow" key={m.month}><span>{m.month}</span><div><div className="acCurveBudget" style={{width:"100%"}}/><div className="acCurveSpent" style={{width:Math.min(100,m.budget>0?m.spent/m.budget*100:0)+"%"}}/></div><b>{clp(m.spent)} / {clp(m.budget)}</b></div>)}</div>
   <h4>Guías imputadas</h4><div className="acGuideRows">{selected.guides.length?selected.guides.map((g,i)=><div key={g.id+"-"+g.month+"-"+i}><b>{g.guide} · {g.month}</b><span>{clp(g.net)} · {g.kind==="extraordinaria"?"Extraordinaria":"Campaña"}</span></div>):<p>Sin guías valorizadas para este contrato.</p>}</div>
   <a className="acConfigureLink" href={"/?vista=clientes"}>Configuración de contratos</a>
  </aside></div>}
 </section>;
}
