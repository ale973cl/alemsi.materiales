"use client";
import {useRouter} from "next/navigation";
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
const actions=[["campañas","Planificar campaña","Abrir planificación"],["consolidado","Revisar necesidades","Ver consolidado"],["compras","Órdenes de compra","Ver documentos"],["recepcion","Registrar recepción","Abrir recepción"],["entregas","Preparar y entregar","Abrir guías"],["inventario","Consultar existencias","Abrir inventario"]] as const;
const display=(value:number|null)=>value===null?"—":new Intl.NumberFormat("es-CL").format(value);
export default function OperationsHome({summary,navigate}:{summary:Summary;navigate:(next:string)=>void}){
 const router=useRouter();
 const max=Math.max(1,...workload.map(item=>summary[item.key]??0));
 const incomplete=Object.values(summary).some(value=>value===null);
 return <div className="operationsDashboard">
  <div className="operationsDashboardIntro"><div><h2>Panel de control operativo</h2><p>Estado de campañas, abastecimiento, bodega y distribución. Cifras consultadas de la base de datos para esta sesión.</p></div><button type="button" onClick={()=>router.refresh()} className="operationsRefresh">Actualizar indicadores</button></div>
  {incomplete&&<p className="operationsDataWarning" role="status">Algunos indicadores no pudieron consultarse o no están disponibles para tu perfil. Se muestran con «—» en vez de cero.</p>}
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
  <section className="operationsMasterSection" aria-label="Maestros activos"><h3>Base operacional</h3><div className="operationsMasterGrid">{catalog.map(item=><button type="button" key={item.key} onClick={()=>navigate(item.destination)}><span>{item.title}</span><strong>{display(summary[item.key])}</strong><small>{item.hint} →</small></button>)}</div></section>
 </div>;
}
