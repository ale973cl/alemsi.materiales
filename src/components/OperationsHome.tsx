"use client";
import {useRouter} from "next/navigation";
import AcOverviewWidget from "@/components/AcOverviewWidget";
import {useState} from "react";
import {sumMaterialBudgets,type GroupKey,type HomeInsights} from "@/lib/home-insights";
type SummaryKey="clients"|"installations"|"materials"|"openCampaigns"|"pendingSurveys"|"openPOs"|"partialReceipts"|"openDispatches"|"financePending"|"emailPending";
type Summary=Record<SummaryKey,number|null>;
type Metric={key:SummaryKey;title:string;hint:string;destination:string};
const workload:Metric[]=[
 {key:"openCampaigns",title:"Campañas abiertas",hint:"Planificación activa",destination:"campañas"},
 {key:"pendingSurveys",title:"Levantamientos pendientes",hint:"Instalaciones por levantar",destination:"levantamientos"},
 {key:"openPOs",title:"Órdenes emitidas",hint:"OC con estado Emitida",destination:"compras"},
 {key:"partialReceipts",title:"Recepciones parciales",hint:"Recepción incompleta",destination:"recepcion"},
 {key:"openDispatches",title:"Guías en proceso",hint:"Preparación y tránsito",destination:"entregas"},
 {key:"emailPending",title:"Correos pendientes",hint:"Mensajes en cola",destination:"clientes"},
];
const catalog:Metric[]=[
 {key:"clients",title:"Clientes activos",hint:"Maestro de clientes",destination:"clientes"},
 {key:"installations",title:"Instalaciones activas",hint:"Sedes registradas",destination:"clientes"},
 {key:"materials",title:"Materiales activos",hint:"Productos del maestro",destination:"inventario"},
];
const actions=[["campañas","Planificar campaña","Abrir planificación"],["consolidado","Revisar necesidades","Ver consolidado"],["compras","Órdenes de compra","Ver documentos"],["recepcion","Registrar recepción","Abrir recepción"],["entregas","Preparar y entregar","Abrir guías"],["inventario","Consultar existencias","Abrir inventario"],["presupuesto","Control presupuestario","Ver gasto neto"]] as const;
const money=(value:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(value);
const display=(value:number|null)=>value===null?"—":new Intl.NumberFormat("es-CL").format(value);
export default function OperationsHome({summary,insights,navigate}:{summary:Summary;insights:HomeInsights;navigate:(next:string)=>void}){
 const [group,setGroup]=useState<GroupKey>("client");
 const [showAllContracts,setShowAllContracts]=useState(false);
 const [showMobileAnalysis,setShowMobileAnalysis]=useState(false);
 const budgetTotals=insights.budgets===null?null:sumMaterialBudgets(insights.budgets);
 const rows=insights.deliveries?.groups[group]||[];
 const router=useRouter();
 const max=Math.max(1,...workload.map(item=>summary[item.key]??0));
 const incomplete=Object.values(summary).some(value=>value===null);
 return <div className="operationsDashboard">
  <div className="operationsDashboardIntro"><div><h2>Panel de control operativo</h2><p>Estado de campañas, abastecimiento, bodega y distribución. Cifras consultadas de la base de datos para esta sesión.</p></div><button type="button" onClick={()=>router.refresh()} className="operationsRefresh">Actualizar indicadores</button></div>
  <AcOverviewWidget/>
  {incomplete&&<p className="operationsDataWarning" role="status">Algunos indicadores no pudieron consultarse o no están disponibles para tu perfil. Se muestran con «—» en vez de cero.</p>}
 <section className="operationsMobileStart" aria-labelledby="operations-mobile-heading">
  <div className="operationsMobileHeading"><h3 id="operations-mobile-heading">Lo importante hoy</h3><span>Operación rápida</span></div>
  <div className="operationsMobileMetrics">
   {([["openCampaigns","Campañas","campañas"],["pendingSurveys","Levantamientos","levantamientos"],["openPOs","OC emitidas","compras"],["openDispatches","Guías en proceso","entregas"]] as const).map(([key,label,destination])=><button key={key} type="button" onClick={()=>navigate(destination)}><span>{label}</span><strong>{display(summary[key])}</strong><span className="mobileMetricGo">Abrir →</span></button>)}
  </div>
  <div className="operationsMobileProgress"><div><span>Guías conformes</span><strong>{insights.deliveries===null?"—":display(insights.deliveries.delivered)}</strong></div><div><span>Con incidencias</span><strong>{insights.deliveries===null?"—":display(insights.deliveries.incident)}</strong></div><div><span>Presupuesto neto de materiales</span><strong>{budgetTotals===null?"—":money(budgetTotals.total)}</strong></div></div>
  <h3 className="operationsMobileTaskTitle">¿Qué necesitas hacer?</h3>
  <div className="operationsMobileTasks">
   {([["campañas","Campañas"],["levantamientos","Levantamientos"],["consolidado","Ver necesidades"],["compras","Crear o revisar OC"],["recepcion","Registrar factura"],["inventario","Consultar stock"],["preparacion","Preparar materiales"],["entregas","Crear guía / Entregar"],["clientes","Clientes e instalaciones"],["presupuesto","Control presupuestario"]] as const).map(([id,label])=><button key={id} type="button" onClick={()=>navigate(id)}><span>{label}</span><span aria-hidden="true">→</span></button>)}
  </div>
  <button type="button" className="operationsMobileExpand" aria-expanded={showMobileAnalysis} aria-controls="operations-complete-analysis" onClick={()=>setShowMobileAnalysis(open=>!open)}>{showMobileAnalysis?"Ocultar análisis completo":"Ver análisis completo: gráficos, clientes y presupuesto"} <span aria-hidden="true">{showMobileAnalysis?"−":"+"}</span></button>
 </section>
 <div id="operations-complete-analysis" className={showMobileAnalysis?"operationsHomeDetail mobileAnalysisExpanded":"operationsHomeDetail"}>
  <section aria-label="Indicadores de operación" className="operationsKpiGrid">
   {workload.map(item=><button key={item.key} type="button" className="operationsKpi" onClick={()=>navigate(item.destination)} aria-label={item.title+": "+(summary[item.key]===null?"sin datos":display(summary[item.key]))+". Abrir módulo"}><span className="operationsKpiLabel">{item.title}</span><strong>{display(summary[item.key])}</strong><small>{item.hint}</small><span className="operationsKpiAction">Abrir sección →</span></button>)}
  </section>
  <div className="operationsDashboardColumns">
   <section className="operationsChart" aria-labelledby="operations-chart-title"><div className="operationsSectionHeading"><h3 id="operations-chart-title">Carga de trabajo por etapa</h3><span>Comparación de registros</span></div>
   <p>Las barras se comparan con el mayor valor visible. Cada etapa representa registros distintos, no porcentajes del proceso completo.</p>
   <div className="operationsBars" role="list">{workload.map(item=>{const value=summary[item.key];const pct=value===null?0:Math.max(0,Math.min(100,value/max*100));return <div className="operationsBarRow" role="listitem" key={item.key}><div className="operationsBarMeta"><span>{item.title}</span><b>{display(value)}</b></div><div className="operationsBarTrack" role="img" aria-label={item.title+": "+(value===null?"sin datos":display(value))}><span style={{width:pct+"%"}}/></div></div>})}</div>
   </section>
   <section className="operationsActions" aria-labelledby="operations-actions-title"><div className="operationsSectionHeading"><h3 id="operations-actions-title">Accesos de trabajo</h3><span>Operación diaria</span></div><div className="operationsActionsGrid">{actions.map(([id,title,hint])=><button type="button" key={id} onClick={()=>navigate(id)}><b>{title}</b><small>{hint}</small><span aria-hidden="true">→</span></button>)}</div></section>
  </div>

  <section className="operationsTracking" aria-labelledby="operations-delivery-title">
   <div className="operationsSectionHeading"><h3 id="operations-delivery-title">Seguimiento de entregas</h3><span>Guías registradas</span></div>
   <p>Consulta las guías por cliente, campaña o mes de movimiento. Los estados muestran entregas conformes, operaciones en curso e incidencias.</p>
   {insights.deliveries===null?<p role="status">Sin datos de entregas disponibles para esta sesión.</p>:<>
    {insights.deliveries.truncated&&<p className="operationsDataWarning" role="status">Se muestran los 1.000 movimientos más recientes; los totales no incluyen registros anteriores.</p>}
    <div className="operationsDeliveryTotals">
     <span>Guías <b>{insights.deliveries.total}</b></span><span>Conformes <b>{insights.deliveries.delivered}</b></span><span>En proceso <b>{insights.deliveries.inProgress}</b></span><span>Con incidencias <b>{insights.deliveries.incident}</b></span>
    </div>
    <div className="operationsGroupControl"><label htmlFor="operations-group">Agrupar por</label><select id="operations-group" value={group} onChange={e=>setGroup(e.target.value as GroupKey)}><option value="client">Cliente</option><option value="campaign">Campaña</option><option value="period">Mes de movimiento</option></select><button type="button" onClick={()=>navigate("entregas")}>Abrir entregas →</button></div>
    <div className="operationsGroupRows">{rows.length===0?<p>No existen guías registradas en esta vista.</p>:rows.map(row=><div className="operationsGroupRow" key={row.id}><div className="operationsGroupName"><b>{row.label}</b><span>{row.total} guía(s) · {row.delivered} conformes · {row.inProgress} en proceso · {row.incident} con incidencias</span></div><div className="operationsSegments" role="img" aria-label={row.label+": "+row.delivered+" conformes, "+row.inProgress+" en proceso, "+row.incident+" con incidencias"}>{row.delivered>0&&<span className="segmentsDone" style={{width:row.delivered/row.total*100+"%"}}/>}{row.inProgress>0&&<span className="segmentsPending" style={{width:row.inProgress/row.total*100+"%"}}/>}{row.incident>0&&<span className="segmentsIncident" style={{width:row.incident/row.total*100+"%"}}/>}</div></div>)}</div>
   </>}
  </section>
  <section className="operationsTracking" aria-labelledby="operations-budgets-title">
   <div className="operationsSectionHeading"><h3 id="operations-budgets-title">Presupuesto neto de materiales por contrato</h3><span>CLP · sin IVA</span></div>
   <p>Solo presupuesto configurado para compra de materiales. No corresponde al valor del servicio ni se interpreta automáticamente como mensual o anual.</p>
   {budgetTotals===null?<p role="status">Sin acceso a presupuestos de materiales para esta sesión.</p>:<>
    <div className="operationsBudgetSummary"><div><span>Presupuesto de materiales configurado</span><strong>{money(budgetTotals.total)}</strong></div><small>{budgetTotals.configured} contrato(s) con presupuesto · {budgetTotals.missing} sin configurar</small></div>
    <div className="operationsBudgetRows">{(showAllContracts?insights.budgets||[]:(insights.budgets||[]).slice(0,6)).map(contract=><div key={contract.id} className="operationsBudgetRow"><div><b>{contract.client}</b><small>{contract.contract}</small></div><strong>{contract.netBudget===null?"Sin configurar":money(contract.netBudget)}</strong></div>)}</div>
    {(insights.budgets||[]).length>6&&<button type="button" className="operationsSeeAll" onClick={()=>setShowAllContracts(!showAllContracts)}>{showAllContracts?"Mostrar menos":"Ver todos los contratos"}</button>}
    <p className="operationsBudgetNote">El saldo utilizado y disponible requiere vincular de forma verificable los movimientos valorizados al contrato y período. No se calcula con cifras estimadas.</p>
   </>}
  </section>
  <section className="operationsMasterSection" aria-label="Maestros activos"><h3>Base operacional</h3><div className="operationsMasterGrid">{catalog.map(item=><button type="button" key={item.key} onClick={()=>navigate(item.destination)}><span>{item.title}</span><strong>{display(summary[item.key])}</strong><small>{item.hint} →</small></button>)}</div></section>
 </div>
 </div>;
}
