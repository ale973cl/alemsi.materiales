"use client";
import {useMemo,useState} from "react";
import {totalsByContract,type BudgetReport} from "@/lib/material-budget-report";
import AcSupplierCredits from "@/components/AcSupplierCredits";
const clp=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
export default function MaterialBudgetModule({report}:{report:BudgetReport|null}){
 const [client,setClient]=useState(""),[contract,setContract]=useState(""),[period,setPeriod]=useState("");
 const clients=useMemo(()=>Array.from(new Map((report?.contracts||[]).map(c=>[c.clientId,{id:c.clientId,name:c.clientName}])).values()).sort((a,b)=>a.name.localeCompare(b.name,"es")),[report]);
 const months=useMemo(()=>Array.from(new Set((report?.movements||[]).map(m=>m.month))).sort().reverse(),[report]);
 const rows=useMemo(()=>report?totalsByContract(report,period,client,contract):[],[report,period,client,contract]);
 const spent=rows.reduce((sum,r)=>sum+r.spent,0);
 return <section className="panel materialBudget" aria-labelledby="material-budget-heading">
  <div className="materialBudgetHeading"><div><h2 id="material-budget-heading">Control presupuestario</h2><p>Compras de materiales recepcionadas y cotejadas, con imputación verificada al contrato.</p></div></div>
  {!report?<p role="status">El informe presupuestario no está disponible para este perfil.</p>:<>
   {report.errors.length>0?<div role="alert" className="operationsDataWarning">No fue posible completar el cálculo: {report.errors.join(" · ")}. No se muestran importes parciales.</div>:<>
    <div className="materialBudgetFilters">
     <label>Cliente<select value={client} onChange={e=>{setClient(e.target.value);setContract("")}}><option value="">Todos los clientes</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     <label>Contrato<select value={contract} onChange={e=>setContract(e.target.value)}><option value="">Todos los contratos</option>{(report.contracts||[]).filter(c=>!client||c.clientId===client).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     <label>Período de factura<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="">Todos los períodos</option>{months.map(m=><option value={m} key={m}>{m}</option>)}</select></label>
    </div>
    <div className="materialBudgetTotals"><div><span>Gasto atribuido, neto</span><strong>{clp(spent)}</strong></div><div><span>Compras sin atribución contractual</span><strong>{clp(report.unattributedNet)}</strong><small>{report.unattributedLines} línea(s), todos los períodos</small></div></div>
    <p className="materialBudgetClarification">El gasto corresponde a facturas ingresadas al inventario y vinculadas a un requerimiento de contrato. El presupuesto configurado puede ser anual, mensual o contractual: el sistema no registra aún su periodicidad. Por ello no se calcula un saldo presupuestario mensual ni una desviación porcentual.</p>
    <div className="materialBudgetRows">{rows.length===0?<p>No hay contratos disponibles para estos filtros.</p>:rows.map(c=><article key={c.id} className="materialBudgetRow"><div><b>{c.clientName}</b><span>{c.name}</span></div><div><small>Presupuesto configurado</small><strong>{c.netBudget===null?"Sin configurar":clp(c.netBudget)}</strong></div><div><small>Gasto documentado{period?" · "+period:""}</small><strong>{clp(c.spent)}</strong></div></article>)}</div>
    {!report.movements.length&&<p role="status">No hay facturas cotejadas con imputación completa a contratos. No se estiman importes con precios actuales.</p>}
   </>}
  </>}
  <AcSupplierCredits/>
 </section>
}
