"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { closeCampaign, derivePurchaseOrder, signOut } from "@/app/actions";

type Props={profile:any;summary:Record<string,number>;campaigns:any[];orders:any[];dispatches:any[];audit:any[]};
const roleModules:Record<string,string[]>={
  "Admin Total":["inicio","maestros","campañas","levantamientos","abastecimiento","oc","finanzas","recepcion","despacho","pendientes","usuarios","correos","auditoria","respaldos"],
  "Gerencia":["inicio","maestros","campañas","levantamientos","abastecimiento","oc","finanzas","recepcion","despacho","pendientes","correos","auditoria"],
  "Admin":["inicio","maestros","campañas","levantamientos","abastecimiento","oc","recepcion","despacho","pendientes","correos"],
  "Finanzas":["inicio","oc","finanzas","recepcion","pendientes","correos"],
  "Bodega":["inicio","recepcion","despacho","pendientes"],
  "Supervisora":["inicio","levantamientos","pendientes"],
};
const labels:Record<string,string>={inicio:"Inicio",maestros:"Clientes y perfiles",campañas:"Campañas",levantamientos:"Levantamientos",abastecimiento:"Consolidado y abastecimiento",oc:"Órdenes de compra",finanzas:"Finanzas",recepcion:"Recepción",despacho:"Despacho y guías",pendientes:"Pendientes",usuarios:"Usuarios",correos:"Motor de correos",auditoria:"Auditoría",respaldos:"Respaldos"};
const stages=["Perfil","Campaña","Conteo","Carencia","Consolidado","Aprobación","OC","Pago","Recepción","Despacho","Entrega"];
const money=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
const date=(v:string)=>v?new Intl.DateTimeFormat("es-CL",{dateStyle:"short",timeStyle:"short",timeZone:"America/Santiago"}).format(new Date(v)):"—";

export default function OperationalApp({profile,summary,campaigns,orders,dispatches,audit}:Props){
  const modules=roleModules[profile.role]||["inicio"];
  const [tab,setTab]=useState("inicio");
  const top=profile.role==="Admin Total"||profile.role==="Gerencia";
  const cards=useMemo(()=>[
    ["Campañas abiertas",summary.openCampaigns,"Campañas"],["Instalaciones pendientes",summary.pendingSurveys,"Levantamientos"],
    ["OC por gestionar",summary.openPOs,"Órdenes de compra"],["Recepciones parciales",summary.partialReceipts,"Recepción"],
    ["Despachos pendientes",summary.openDispatches,"Despacho"],["Tareas de pago",summary.financePending,"Finanzas"],
  ],[summary]);
  return <div className="portal">
    <header className="portalTop"><Image src="/alemsi-logo.png" width={235} height={92} alt="ALEMSI" priority/><div className="userBox"><span className={top?"rank superior":"rank"}>{top?"PERFIL SUPERIOR":"PERFIL OPERATIVO"}</span><strong>{profile.full_name||profile.email}</strong><small>{profile.role}</small><form action={signOut}><button className="linkBtn">Cerrar sesión</button></form></div></header>
    <div className="portalBody"><aside><div className="productTitle">Control de materiales<small>Desarrollo · Supabase central</small></div>{modules.map(m=><button key={m} className={tab===m?"nav active":"nav"} onClick={()=>setTab(m)}>{labels[m]}</button>)}</aside>
    <main className="workspace"><div className="pageHead"><div><p className="eyebrow">ALEMSI MATERIALES</p><h1>{labels[tab]}</h1></div><span className="live">● Datos centralizados</span></div>
      {tab==="inicio"&&<><section className="flow">{stages.map((s,i)=><div key={s}><b>{i+1}</b><span>{s}</span></div>)}</section><section className="cards">{cards.map(([a,b,c])=><article key={String(a)}><small>{a}</small><strong>{b}</strong><span>{c}</span></article>)}</section><section className="panel"><h2>Base operativa</h2><div className="three"><p><b>{summary.clients}</b> clientes activos</p><p><b>{summary.installations}</b> instalaciones</p><p><b>{summary.materials}</b> materiales activos</p></div><p className="note">El Excel se conserva como antecedente de perfil. Inventario disponible se reconoce desde recepción física y asignación, nunca desde una cantidad histórica.</p></section></>}
      {tab==="campañas"&&<section className="panel"><h2>Universo cerrado de levantamientos</h2><p>Cada campaña controla X/Y instalaciones y no puede cerrarse con pendientes sin justificación formal.</p><div className="table">{campaigns.length?campaigns.map(c=><div className="row" key={c.id}><span><b>{c.label}</b><small>{c.contracts?.clients?.legal_name||"Cliente"} · {c.contracts?.name||"Contrato"}</small></span><em>{c.status}</em>{c.status==="Abierta"&&<form action={closeCampaign}><input type="hidden" name="campaign_id" value={c.id}/><button>Cerrar con validación</button></form>}</div>):<Empty/>}</div></section>}
      {tab==="oc"&&<section className="panel"><h2>Órdenes de compra y derivación</h2><p>Operaciones deriva la OC al proveedor y genera simultáneamente la tarea para Finanzas. Los montos operacionales se muestran netos.</p><div className="table">{orders.length?orders.map(o=><div className="row" key={o.id}><span><b>{o.order_number||"OC sin folio"}</b><small>{o.suppliers?.legal_name||"Proveedor"}</small></span><strong>{money(Number(o.total_net))} neto</strong><em>{o.status}</em>{["Admin Total","Gerencia","Admin"].includes(profile.role)&&<form action={derivePurchaseOrder}><input type="hidden" name="purchase_order_id" value={o.id}/><button>Derivar OC y pago</button></form>}</div>):<Empty/>}</div></section>}
      {tab==="despacho"&&<section className="panel"><h2>Despachos con origen preservado</h2><p>La entrega parcial mantiene abierto el saldo del requerimiento original.</p><div className="table">{dispatches.length?dispatches.map(d=><div className="row" key={d.id}><span><b>{d.guide_number||"Guía pendiente"}</b><small>{d.installations?.name} · {d.installations?.region}</small></span><em>{d.status}</em></div>):<Empty/>}</div></section>}
      {tab==="pendientes"&&<section className="panel"><h2>Control transversal de excepciones</h2><div className="cards compact">{cards.filter(([,v])=>Number(v)>0).map(([a,b,c])=><article key={String(a)}><small>{a}</small><strong>{b}</strong><span>{c}</span></article>)}</div>{cards.every(([,v])=>Number(v)===0)&&<Empty/>}</section>}
      {tab==="correos"&&<section className="panel"><h2>Un motor, reglas por módulo</h2><div className="emailGrid"><article><b>Infraestructura única</b><p>Cola, idempotencia, reintentos, estado y eventos de entrega.</p></article><article><b>Plantillas modulares</b><p>Campañas, aprobaciones, OC, Finanzas, recepción, despacho y alertas.</p></article><article><b>Destinatarios trazables</b><p>Proveedor, instalación, Operaciones y copia a Finanzas según el evento.</p></article></div><p className="note">Correos pendientes en cola: <b>{summary.emailPending}</b>.</p></section>}
      {tab==="auditoria"&&<section className="panel"><h2>Trazabilidad reciente</h2><div className="table">{audit.length?audit.map(a=><div className="row" key={a.id}><span><b>{a.module} · {a.action}</b><small>{a.actor_name||"Sistema"}</small></span><time>{date(a.created_at)}</time></div>):<Empty/>}</div></section>}
      {!['inicio','campañas','oc','despacho','pendientes','correos','auditoria'].includes(tab)&&<ModuleInfo tab={tab} summary={summary}/>} 
    </main></div>
  </div>;
}
function Empty(){return <div className="empty"><b>Sin registros disponibles</b><span>El módulo está conectado y respetará los permisos RLS del usuario.</span></div>}
function ModuleInfo({tab,summary}:{tab:string;summary:Record<string,number>}){const descriptions:Record<string,string>={maestros:"Fichas de cliente, contrato, instalación, contactos, perfiles autorizados y evidencia original del Excel.",levantamientos:"Experiencia móvil: base autorizada, remanente físico y carencia calculada automáticamente.",abastecimiento:"Consolidación con origen, límites contractuales, sugerencia de proveedor y decisión final de Gerencia.",finanzas:"Tareas de pago derivadas desde OC y compras locales, con neto e IVA separados.",recepcion:"Cotejo pedido/recibido/facturado, actualización controlada de precio y disponibilidad para despacho.",usuarios:"Individualización, jerarquía y asignación real de instalaciones respaldada por RLS.",respaldos:"Generación de ZIP independiente y trazable. No existen acciones de restauración global."};return <section className="panel"><h2>{labels[tab]}</h2><p>{descriptions[tab]}</p><div className="empty"><b>Módulo integrado a Supabase</b><span>Su información aparecerá de acuerdo con el perfil y las asignaciones del usuario.</span></div></section>}
