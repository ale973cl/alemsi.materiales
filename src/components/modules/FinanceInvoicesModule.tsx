"use client";
import {useState} from "react";
import FinanceDashboard from "@/components/modules/FinanceDashboard";
import FinancePurchaseRegister from "@/components/modules/FinancePurchaseRegister";

type View="dashboard"|"clients"|"invoices"|"orders"|"reports";
const tabs:[View,string][]=[["dashboard","Resumen regional"],["clients","Clientes y contratos"],["invoices","Facturas y pagos"],["orders","OC pendientes"],["reports","Informes"]];

export default function FinanceInvoicesModule({role}:{role:string}){
 const [view,setView]=useState<View>("dashboard");
 return <div className="financeShell">
  <nav className="financeTabs" aria-label="Secciones de Finanzas">{tabs.map(([id,label])=><button key={id} type="button" className={view===id?"active":""} onClick={()=>setView(id)}>{label}</button>)}</nav>
  {view==="dashboard"&&<FinanceDashboard mode="dashboard"/>}
  {view==="clients"&&<FinanceDashboard mode="clients"/>}
  {view==="invoices"&&<FinancePurchaseRegister role={role}/>} 
  {view==="orders"&&<FinanceDashboard mode="orders"/>}
  {view==="reports"&&<FinanceDashboard mode="reports"/>}
  <style jsx>{`.financeShell{display:grid;gap:14px}.financeTabs{display:flex;gap:8px;flex-wrap:wrap;padding:8px;background:#f4f7f8;border:1px solid #dce5e8;border-radius:14px;position:sticky;top:8px;z-index:4}.financeTabs button{border:0;background:transparent;color:#18333b;padding:10px 14px;border-radius:10px;font-weight:750;cursor:pointer}.financeTabs button.active{background:#fff;box-shadow:0 1px 5px rgba(16,45,54,.12)}@media(max-width:650px){.financeTabs{position:static;display:grid;grid-template-columns:1fr 1fr}.financeTabs button{text-align:left;padding:9px}.financeTabs button:first-child{grid-column:1/-1}}`}</style>
 </div>
}
