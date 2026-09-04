"use client";

import { useEffect, useMemo, useState } from "react";
import master from "@/data/master.json";
import operations from "@/data/operations.v02.json";

type Installation = { id:string; name:string; city:string; commune:string; address:string; active?:boolean };
type Profile = { id:string; region:string; institution:string; clientName:string; installations:Installation[] };
type Product = { id:string; name:string; price:number };
type CountLine = { productId:string; productName:string; baseQty:number; remainder:number; shortage:number; unitPrice:number };
type Survey = { id:string; profileId:string; installationId:string; installationName:string; date:string; remote:boolean; lines:CountLine[]; shortageNet:number };
type LocalPurchase = { id:string; surveyId:string; installationName:string; requestedAmount:number; approvedAmount:number; mode:"Anticipo"|"Contra boleta"; status:"Solicitada"|"Aprobada Gerencia"|"En Finanzas"|"Transferida"|"Rendida" };
type PurchaseOrder = { id:string; supplier:string; totalNet:number; status:"Propuesta"|"Emitida"|"Recibida" };
type Dispatch = { id:string; installationName:string; required:number; delivered:number; status:"Pendiente"|"Parcial"|"Cerrada" };

const profiles = operations.profiles as Profile[];
const products:Product[] = (master.products as any[]).map((p,i)=>({
  id:String(p.id||`p-${i+1}`),
  name:String(p.name||p.product||p.descripcion||`Producto ${i+1}`),
  price:Number(p.price??p.netPrice??p.precio??p.unitPrice??0)||0,
}));
const clp=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
const read=<T,>(k:string,f:T):T=>{if(typeof window==="undefined")return f;try{return JSON.parse(localStorage.getItem(k)||"")||f}catch{return f}};

export default function Page(){
  const [tab,setTab]=useState("inicio");
  const [profileId,setProfileId]=useState(profiles[0]?.id||"");
  const [surveys,setSurveys]=useState<Survey[]>([]);
  const [locals,setLocals]=useState<LocalPurchase[]>([]);
  const [ocs,setOcs]=useState<PurchaseOrder[]>([]);
  const [dispatches,setDispatches]=useState<Dispatch[]>([]);
  const [modal,setModal]=useState<string|null>(null);
  const [ready,setReady]=useState(false);

  useEffect(()=>{setSurveys(read("alemsi-v03-surveys",[]));setLocals(read("alemsi-v03-locals",[]));setOcs(read("alemsi-v03-ocs",[]));setDispatches(read("alemsi-v03-dispatches",[]));setReady(true)},[]);
  useEffect(()=>{if(!ready)return;localStorage.setItem("alemsi-v03-surveys",JSON.stringify(surveys));localStorage.setItem("alemsi-v03-locals",JSON.stringify(locals));localStorage.setItem("alemsi-v03-ocs",JSON.stringify(ocs));localStorage.setItem("alemsi-v03-dispatches",JSON.stringify(dispatches))},[surveys,locals,ocs,dispatches,ready]);

  const profile=profiles.find(p=>p.id===profileId)||profiles[0];
  const installations=(profile?.installations||[]).filter(i=>i.active!==false);
  const ps=surveys.filter(s=>s.profileId===profile?.id);
  const readIds=new Set(ps.map(s=>s.installationId));
  const done=installations.filter(i=>readIds.has(i.id)).length;
  const total=installations.length;
  const missing=installations.filter(i=>!readIds.has(i.id));
  const allDone=total>0&&done===total;

  const consolidated=useMemo(()=>{
    const m=new Map<string,{name:string;qty:number;net:number}>();
    ps.filter(s=>!s.remote).forEach(s=>s.lines.filter(l=>l.shortage>0).forEach(l=>{
      const x=m.get(l.productId)||{name:l.productName,qty:0,net:0};x.qty+=l.shortage;x.net+=l.shortage*l.unitPrice;m.set(l.productId,x);
    }));
    return Array.from(m.entries()).map(([id,x])=>({id,...x}));
  },[ps]);
  const consolidatedNet=consolidated.reduce((a,x)=>a+x.net,0);

  const nav=[["inicio","Inicio"],["levantamientos","Levantamientos"],["consolidado","Consolidado"],["abastecimiento","Abastecimiento"],["compras","OC / Compras"],["recepcion","Recepción / Factura"],["despachos","Despachos"],["pendientes","Pendientes"],["kits","Kits"],["gestion","Gestión"]];

  return <div className="app">
    <header className="top"><div><div className="brand">ALEMSI Materiales</div><div className="sub">Circuito operacional V0.3 · Levantamiento a cierre</div></div><div className="statusTop"><b>{done}/{total}</b><span>instalaciones levantadas</span></div></header>
    <div className="shell"><aside className="side">{nav.map(([k,l])=><button key={k} className={`navbtn ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</button>)}</aside>
    <main className="main">
      <div className="context"><div><span>SECTOR / CONTRATO</span><select value={profileId} onChange={e=>setProfileId(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.region} · {p.institution}</option>)}</select></div><b className={allDone?"okText":"warnText"}>{allDone?"Levantamiento completo":`${missing.length} instalaciones pendientes`}</b></div>

      {tab==="inicio"&&<><h1>Control integral de materiales</h1><p className="lead">El circuito parte en terreno, calcula carencias, consolida lo válido y termina cuando el material queda entregado y la guía cerrada.</p><div className="grid g4"><K l="Instalaciones esperadas" v={total}/><K l="Levantadas" v={done}/><K l="Carencia consolidada" v={clp(consolidatedNet)}/><K l="Pendientes globales" v={locals.filter(x=>x.status!=="Rendida").length+dispatches.filter(x=>x.status!=="Cerrada").length}/></div><Flow/>{!allDone&&<div className="notice warning"><b>No cerrar todavía.</b> Faltan {missing.length} instalaciones por levantar.</div>}</>}

      {tab==="levantamientos"&&<><div className="titleRow"><div><h1>Levantamientos</h1><p className="lead">Universo cerrado de instalaciones del sector seleccionado.</p></div><strong>{done}/{total}</strong></div><div className="progress"><span style={{width:`${total?(done/total)*100:0}%`}}/></div><div className="tableWrap"><table><thead><tr><th>Instalación</th><th>Comuna</th><th>Estado</th><th>Fecha</th><th></th></tr></thead><tbody>{installations.map(i=>{const s=ps.find(x=>x.installationId===i.id);return <tr key={i.id}><td><b>{i.name}</b><div className="small muted">{i.address}</div></td><td>{i.commune}</td><td><span className={`pill ${s?"ok":"warn"}`}>{s?"Levantada":"Pendiente"}</span></td><td>{s?.date||"—"}</td><td><button className="btn primary" onClick={()=>setModal(i.id)}>{s?"Actualizar":"Levantar"}</button></td></tr>})}</tbody></table></div>{allDone&&<div className="notice success"><b>100% completado.</b> El lote puede pasar a abastecimiento.</div>}</>}

      {tab==="consolidado"&&<><h1>Consolidado de carencias</h1><p className="lead">Acumula las carencias de flujo normal. Las instalaciones marcadas como excepción logística quedan separadas.</p><div className="grid g3"><K l="Avance" v={`${done}/${total}`}/><K l="Productos con carencia" v={consolidated.length}/><K l="Valor neto estimado" v={clp(consolidatedNet)}/></div>{!allDone&&<div className="notice warning">Consolidado preliminar: no emitir OC definitiva hasta completar o justificar todas las instalaciones.</div>}<div className="tableWrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Valor neto</th></tr></thead><tbody>{consolidated.length?consolidated.map(x=><tr key={x.id}><td><b>{x.name}</b></td><td>{x.qty}</td><td>{clp(x.net)}</td></tr>):<tr><td colSpan={3} className="muted">Sin carencias consolidadas todavía.</td></tr>}</tbody></table></div></>}

      {tab==="abastecimiento"&&<><h1>Abastecimiento</h1><p className="lead">Gerencia decide qué comprar, cuánto comprar y dónde comprar, usando el consolidado y la logística.</p><div className="grid g2"><div className="card"><h2>Flujo normal</h2><Info l="Valor consolidado" v={clp(consolidatedNet)}/><Info l="Productos" v={String(consolidated.length)}/><Info l="Estado" v={allDone?"Listo para decisión":"Levantamiento incompleto"}/><button className="btn primary full" disabled={!allDone||!consolidated.length} onClick={()=>{if(!ocs.some(x=>x.id===`oc-${profile.id}`))setOcs([{id:`oc-${profile.id}`,supplier:"Proveedor por definir",totalNet:consolidatedNet,status:"Propuesta"},...ocs]);setTab("compras")}}>Preparar propuesta de OC</button></div><div className="card"><h2>Excepciones logísticas</h2><Info l="Solicitudes locales" v={String(locals.length)}/><Info l="Esperando Gerencia" v={String(locals.filter(x=>x.status==="Solicitada").length)}/><Info l="Esperando Finanzas" v={String(locals.filter(x=>["Aprobada Gerencia","En Finanzas"].includes(x.status)).length)}/></div></div><div className="tableWrap"><table><thead><tr><th>Instalación</th><th>Solicitado</th><th>Autorizado</th><th>Modalidad</th><th>Estado</th><th></th></tr></thead><tbody>{locals.length?locals.map(lp=><tr key={lp.id}><td>{lp.installationName}</td><td>{clp(lp.requestedAmount)}</td><td>{lp.approvedAmount?clp(lp.approvedAmount):"—"}</td><td><select value={lp.mode} onChange={e=>setLocals(locals.map(x=>x.id===lp.id?{...x,mode:e.target.value as LocalPurchase["mode"]}:x))}><option>Anticipo</option><option>Contra boleta</option></select></td><td>{lp.status}</td><td>{lp.status==="Solicitada"&&<button className="btn" onClick={()=>{const n=Number(prompt("Monto máximo autorizado por Gerencia",String(lp.requestedAmount))||0);if(n)setLocals(locals.map(x=>x.id===lp.id?{...x,approvedAmount:n,status:"Aprobada Gerencia"}:x))}}>Autorizar Gerencia</button>}{lp.status==="Aprobada Gerencia"&&<button className="btn" onClick={()=>setLocals(locals.map(x=>x.id===lp.id?{...x,status:"En Finanzas"}:x))}>Enviar a Finanzas</button>}{lp.status==="En Finanzas"&&<button className="btn primary" onClick={()=>setLocals(locals.map(x=>x.id===lp.id?{...x,status:"Transferida"}:x))}>Registrar transferencia</button>}</td></tr>):<tr><td colSpan={6} className="muted">Sin excepciones logísticas.</td></tr>}</tbody></table></div></>}

      {tab==="compras"&&<><h1>OC / Compras</h1><p className="lead">Una compra consolidada puede dividirse entre varios proveedores. Esta V0.3 muestra la decisión y emisión básica.</p><div className="tableWrap"><table><thead><tr><th>OC</th><th>Proveedor</th><th>Neto</th><th>Estado</th><th></th></tr></thead><tbody>{ocs.length?ocs.map(oc=><tr key={oc.id}><td><b>{oc.id}</b></td><td><input value={oc.supplier} onChange={e=>setOcs(ocs.map(x=>x.id===oc.id?{...x,supplier:e.target.value}:x))}/></td><td>{clp(oc.totalNet)}</td><td>{oc.status}</td><td><button className="btn primary" disabled={oc.status!=="Propuesta"} onClick={()=>setOcs(ocs.map(x=>x.id===oc.id?{...x,status:"Emitida"}:x))}>Emitir OC</button></td></tr>):<tr><td colSpan={5}>Sin OC.</td></tr>}</tbody></table></div></>}

      {tab==="recepcion"&&<><h1>Recepción / Factura</h1><p className="lead">La factura fija el costo neto real y la recepción carga reposición disponible para despachar.</p><div className="tableWrap"><table><thead><tr><th>OC</th><th>Proveedor</th><th>Neto</th><th>Estado</th><th></th></tr></thead><tbody>{ocs.length?ocs.map(oc=><tr key={oc.id}><td>{oc.id}</td><td>{oc.supplier}</td><td>{clp(oc.totalNet)}</td><td>{oc.status}</td><td>{oc.status==="Emitida"&&<button className="btn primary" onClick={()=>{setOcs(ocs.map(x=>x.id===oc.id?{...x,status:"Recibida"}:x));const ds=installations.map(i=>{const s=ps.find(x=>x.installationId===i.id);return {id:`gd-${profile.id}-${i.id}`,installationName:i.name,required:s?.lines.reduce((a,l)=>a+l.shortage,0)||0,delivered:0,status:"Pendiente" as const}}).filter(d=>d.required>0&&!dispatches.some(x=>x.id===d.id));setDispatches([...ds,...dispatches])}}>Registrar recepción / factura</button>}</td></tr>):<tr><td colSpan={5}>Sin OC emitidas.</td></tr>}</tbody></table></div><div className="notice">En la versión con base de datos aquí quedará la relación factura–OC, actualización de precio vigente, diferencias y recepción parcial.</div></>}

      {tab==="despachos"&&<><h1>Despachos y guías</h1><p className="lead">Una entrega parcial mantiene abierta la diferencia.</p><div className="tableWrap"><table><thead><tr><th>Instalación</th><th>Requerido</th><th>Entregado</th><th>Diferencia</th><th>Estado</th><th></th></tr></thead><tbody>{dispatches.length?dispatches.map(d=><tr key={d.id}><td><b>{d.installationName}</b></td><td>{d.required}</td><td>{d.delivered}</td><td>{Math.max(0,d.required-d.delivered)}</td><td>{d.status}</td><td><button className="btn" onClick={()=>{const n=Number(prompt("Cantidad efectivamente entregada",String(d.delivered))||0);const st:Dispatch["status"]=n>=d.required?"Cerrada":n>0?"Parcial":"Pendiente";setDispatches(dispatches.map(x=>x.id===d.id?{...x,delivered:n,status:st}:x))}}>Registrar guía</button></td></tr>):<tr><td colSpan={6}>Sin despachos.</td></tr>}</tbody></table></div></>}

      {tab==="pendientes"&&<><h1>Pendientes globales</h1><div className="grid g4"><K l="Sin levantar" v={missing.length}/><K l="Compra local abierta" v={locals.filter(x=>x.status!=="Rendida").length}/><K l="OC abiertas" v={ocs.filter(x=>x.status!=="Recibida").length}/><K l="Guías abiertas" v={dispatches.filter(x=>x.status!=="Cerrada").length}/></div><div className="notice warning">Aquí deben terminar todas las excepciones: saldos de OC, parciales, pendientes de despacho, diferencias factura/recepción y guías no cerradas.</div></>}

      {tab==="kits"&&<><h1>Kit Maestro</h1><p className="lead">Circuito separado de consumibles, configurado por contrato e instalación.</p><div className="card"><ul><li>Entrega inicial por instalación.</li><li>Dotación y simultaneidad de turnos.</li><li>Elementos compartidos.</li><li>Reposición por desgaste, rotura o deterioro según regla.</li><li>Equipos exigidos por contrato.</li><li>Control al cierre del contrato.</li></ul></div></>}

      {tab==="gestion"&&<><h1>Gestión</h1><div className="grid g3"><Module t="Maestro de materiales" d={`${products.length} productos de la base actual.`}/><Module t="Clientes / contratos" d={`${profiles.length} perfiles cargados.`}/><Module t="Instalaciones" d="Región, comuna, localidad y condición logística."/><Module t="Proveedores" d="Prioritario, alternativos y precio neto."/><Module t="Límites" d="Cantidad, presupuesto o ambos."/><Module t="Usuarios / perfiles" d="Supervisión, Gerencia, Finanzas y administración."/></div><div className="toolbar"><button className="btn danger" onClick={()=>{if(confirm("¿Restablecer movimientos V0.3?")){["alemsi-v03-surveys","alemsi-v03-locals","alemsi-v03-ocs","alemsi-v03-dispatches"].forEach(k=>localStorage.removeItem(k));location.reload()}}}>Restablecer prueba</button></div></>}
    </main></div>

    {modal&&<SurveyModal profile={profile} installation={installations.find(i=>i.id===modal)!} existing={ps.find(s=>s.installationId===modal)} onClose={()=>setModal(null)} onSave={(s,lp)=>{setSurveys([s,...surveys.filter(x=>!(x.profileId===s.profileId&&x.installationId===s.installationId))]);if(lp)setLocals([lp,...locals.filter(x=>x.surveyId!==s.id)]);setModal(null)}}/>}
  </div>
}

function SurveyModal({profile,installation,existing,onClose,onSave}:{profile:Profile;installation:Installation;existing?:Survey;onClose:()=>void;onSave:(s:Survey,lp?:LocalPurchase)=>void}){
  const [remote,setRemote]=useState(existing?.remote||false);
  const [lines,setLines]=useState<CountLine[]>(existing?.lines||products.slice(0,14).map(p=>({productId:p.id,productName:p.name,baseQty:0,remainder:0,shortage:0,unitPrice:p.price})));
  const upd=(i:number,k:"baseQty"|"remainder",v:number)=>setLines(ls=>ls.map((l,n)=>{if(n!==i)return l;const x={...l,[k]:Math.max(0,v)};x.shortage=Math.max(0,x.baseQty-x.remainder);return x}));
  const net=lines.reduce((a,l)=>a+l.shortage*l.unitPrice,0);
  const save=()=>{const id=existing?.id||`lev-${profile.id}-${installation.id}`;const s:Survey={id,profileId:profile.id,installationId:installation.id,installationName:installation.name,date:new Date().toISOString().slice(0,10),remote,lines,shortageNet:net};const lp=remote&&net>0?{id:`local-${id}`,surveyId:id,installationName:installation.name,requestedAmount:net,approvedAmount:0,mode:"Anticipo" as const,status:"Solicitada" as const}:undefined;onSave(s,lp)};
  return <div className="modalBg"><div className="modal"><div className="titleRow"><div><h2>Levantamiento</h2><p>{installation.name} · {installation.commune}</p></div><button className="btn" onClick={onClose}>Cerrar</button></div><div className="notice">Registrar existencia física. Carencia = base autorizada − remanente.</div><div className="tableWrap"><table><thead><tr><th>Material</th><th>Precio neto</th><th>Base</th><th>Remanente</th><th>Carencia</th><th>Valor</th></tr></thead><tbody>{lines.map((l,i)=><tr key={l.productId}><td>{l.productName}</td><td>{l.unitPrice?clp(l.unitPrice):"Pendiente"}</td><td><input type="number" min={0} value={l.baseQty} onChange={e=>upd(i,"baseQty",Number(e.target.value)||0)}/></td><td><input type="number" min={0} value={l.remainder} onChange={e=>upd(i,"remainder",Number(e.target.value)||0)}/></td><td><b>{l.shortage}</b></td><td>{clp(l.shortage*l.unitPrice)}</td></tr>)}</tbody></table></div><div className="grid g2"><div className="card"><Info l="Carencia valorizada" v={clp(net)}/><Info l="Productos faltantes" v={String(lines.filter(l=>l.shortage>0).length)}/></div><div className="card"><label className="check"><input type="checkbox" checked={remote} onChange={e=>setRemote(e.target.checked)}/> Instalación pequeña/remota: evaluar costo de despacho.</label><p className="small muted">Marcada: sale del consolidado normal y genera solicitud de Compra Local a Gerencia.</p></div></div><div className="toolbar end"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Confirmar levantamiento</button></div></div></div>
}

function K({l,v}:{l:string;v:string|number}){return <div className="card kpi"><span>{l}</span><b>{v}</b></div>}
function Info({l,v}:{l:string;v:string}){return <div className="info"><span>{l}</span><b>{v}</b></div>}
function Module({t,d}:{t:string;d:string}){return <div className="card"><h2>{t}</h2><p className="muted">{d}</p></div>}
function Flow(){return <div className="flow">{["Levantamiento","Carencia","Consolidado","Gerencia","OC","Factura","Reposición","Despacho","Guía / Cierre"].map((x,i)=><div className="flowStep" key={x}><span>{i+1}</span><b>{x}</b></div>)}</div>}
