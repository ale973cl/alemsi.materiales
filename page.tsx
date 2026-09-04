"use client";

import {useEffect,useMemo,useState} from "react";
import master from "@/data/master.json";
import operations from "@/data/operations.v02.json";
import type {AppState,Contract,HistoricalRecord,Installation,MaterialRequest,RequestLine} from "@/types";
import {clearState,loadState,saveState} from "@/lib/storage";

type MasterClient={name:string;budget4m:number;totalUnits4m:number;authorizedProducts:number};
type Product={id:string;name:string;price:number|null;[key:string]:unknown};
type Profile={
  id:string;region:string;institution:string;clientName:string;procurementId:string;purchaseOrder:string;provider:string;
  status:string;services:string[];sourceUrl:string;monthlyNet:number|null;contractNet:number|null;installations:Installation[];
};

const masterClients=(master.clients as MasterClient[]);
const rawProducts=master.products as any[];
const products:Product[]=rawProducts.map((p,i)=>({
  id:String(p.id||`p${i+1}`),
  name:String(p.name||p.product||p.descripcion||`Producto ${i+1}`),
  price:Number(p.price??p.netPrice??p.precio??p.unitPrice??0)||null,
  ...p
}));
const profiles=operations.profiles as Profile[];
const history=operations.historical as HistoricalRecord[];

const slug=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const clp=(n:number|null|undefined)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(n)||0);

const seededContracts:Contract[]=[...profiles.map((p)=>{
  const mc=masterClients.find(c=>c.name.toLowerCase()===p.clientName.toLowerCase());
  return {
    id:p.id,clientId:slug(p.clientName),name:`Contrato ${p.clientName}`,
    periodLabel:"Base operativa V0.2",budget4m:mc?.budget4m||0,startDate:"",endDate:"",active:true,
    region:p.region,institution:p.institution,procurementId:p.procurementId,purchaseOrder:p.purchaseOrder,
    provider:p.provider,statusLabel:p.status,services:p.services,sourceUrl:p.sourceUrl,monthlyNet:p.monthlyNet,contractNet:p.contractNet
  };
}),...masterClients.filter(mc=>!profiles.some(p=>p.clientName.toLowerCase()===mc.name.toLowerCase())).map((mc,i)=>({
  id:`excel-${slug(mc.name)}-${i}`,clientId:slug(mc.name),name:`Contrato ${mc.name}`,periodLabel:"Base inicial Excel · 4 meses",
  budget4m:mc.budget4m,startDate:"",endDate:"",active:true,region:mc.name.includes("Biobío")?"Biobío":"Por clasificar",
  institution:mc.name.replace(/ Biobío$/,""),statusLabel:"Base Excel · contrato pendiente de cotejo",services:["Aseo / materiales"],sourceUrl:""
}))];

const seededInstallations:Record<string,Installation[]>=Object.fromEntries(profiles.map(p=>[p.id,p.installations.map(x=>({...x,active:x.active!==false}))]));
const fallback:AppState={contracts:seededContracts,installations:seededInstallations,requests:[],budgetOverrides:{}};

function mergeSeed(stored:AppState):AppState{
  const byId=new Map(stored.contracts.map(c=>[c.id,c]));
  const contracts=seededContracts.map(seed=>({...seed,...(byId.get(seed.id)||{})}));
  stored.contracts.forEach(c=>{if(!contracts.some(x=>x.id===c.id))contracts.push(c)});
  const installations:{[key:string]:Installation[]}={...seededInstallations};
  for(const [cid,seedItems] of Object.entries(seededInstallations)){
    const old=stored.installations?.[cid]||[];
    const oldMap=new Map(old.map(x=>[x.id,x]));
    installations[cid]=seedItems.map(x=>({...x,...(oldMap.get(x.id)||{})}));
    old.forEach(x=>{if(!installations[cid].some(y=>y.id===x.id))installations[cid].push(x)});
  }
  Object.entries(stored.installations||{}).forEach(([cid,items])=>{if(!installations[cid])installations[cid]=items});
  return {contracts,installations,requests:stored.requests||[],budgetOverrides:stored.budgetOverrides||{}};
}

export default function Page(){
  const [tab,setTab]=useState("inicio");
  const [state,setState]=useState<AppState>(fallback);
  const [ready,setReady]=useState(false);
  const [selectedContract,setSelectedContract]=useState(seededContracts[0]?.id||"");
  const [regionFilter,setRegionFilter]=useState("Todas");
  const [modal,setModal]=useState<string|null>(null);
  const [editingInstallation,setEditingInstallation]=useState<Installation|null>(null);

  useEffect(()=>{setState(mergeSeed(loadState(fallback)));setReady(true)},[]);
  useEffect(()=>{if(ready)saveState(state)},[state,ready]);

  const contract=state.contracts.find(c=>c.id===selectedContract)||state.contracts[0];
  const inst=contract?state.installations[contract.id]||[]:[];
  const reqs=contract?state.requests.filter(r=>r.contractId===contract.id):[];
  const contractHistory=contract?history.filter(h=>h.contractId===contract.id):[];
  const spent=reqs.filter(r=>r.status!=="Borrador").reduce((s,r)=>s+r.total,0);
  const budget=contract?(state.budgetOverrides[contract.id]??contract.budget4m):0;
  const available=Math.max(0,budget-spent);
  const pct=budget?Math.min(100,(spent/budget)*100):0;
  const regions=useMemo(()=>["Todas",...Array.from(new Set(state.contracts.map(c=>c.region||"Por clasificar"))).sort()], [state.contracts]);

  const saveBudget=(v:number)=>setState(s=>({...s,budgetOverrides:{...s.budgetOverrides,[contract.id]:v}}));
  const addInstallation=(x:Omit<Installation,"id"|"active">)=>{
    const ni={...x,id:crypto.randomUUID(),active:true};
    setState(s=>({...s,installations:{...s.installations,[contract.id]:[...(s.installations[contract.id]||[]),ni]}}));setModal(null);
  };
  const updateInstallation=(x:Installation)=>{
    setState(s=>({...s,installations:{...s.installations,[contract.id]:(s.installations[contract.id]||[]).map(i=>i.id===x.id?x:i)}}));
    setEditingInstallation(null);
  };
  const addRequest=(r:MaterialRequest)=>{setState(s=>({...s,requests:[r,...s.requests]}));setModal(null)};

  return <div className="app">
    <header className="top"><div><div className="brand">ALEMSI Materiales</div><div className="sub">Control territorial, contractual e histórico · V0.3</div></div><div className="small">Datos: Excel operativo + contratos cotejados</div></header>
    <div className="shell"><aside className="side">
      {[["inicio","Inicio"],["contratos","Contratos"],["instalaciones","Instalaciones"],["historico","Histórico"],["maestro","Materiales"],["solicitudes","Solicitudes"]].map(([k,l])=><button key={k} className={`navbtn ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</button>)}
    </aside><main className="main">
      <div className="toolbar regionBar"><label className="small muted"><b>Región</b></label><select value={regionFilter} onChange={e=>setRegionFilter(e.target.value)}>{regions.map(r=><option key={r}>{r}</option>)}</select>
      {contract&&<><span className="crumb">{contract.region} › {contract.institution}</span><select value={selectedContract} onChange={e=>setSelectedContract(e.target.value)}>{state.contracts.filter(c=>regionFilter==="Todas"||c.region===regionFilter).map(c=><option key={c.id} value={c.id}>{c.clientId?c.name.replace(/^Contrato /,""):c.name}</option>)}</select></>}</div>

      {tab==="inicio"&&<Inicio contracts={state.contracts} installations={state.installations} requests={state.requests} history={history} region={regionFilter} onOpen={(id)=>{setSelectedContract(id);setTab("contratos")}}/>}
      {tab==="contratos"&&contract&&<ContratoView contract={contract} budget={budget} spent={spent} available={available} pct={pct} installations={inst.length} requests={reqs.length} historical={contractHistory.length} onBudget={saveBudget}/>} 
      {tab==="instalaciones"&&contract&&<Instalaciones contract={contract} items={inst} historical={contractHistory} onAdd={()=>setModal("inst")} onEdit={setEditingInstallation} onToggle={(id)=>setState(s=>({...s,installations:{...s.installations,[contract.id]:inst.map(x=>x.id===id?{...x,active:!x.active}:x)}}))}/>} 
      {tab==="historico"&&<Historico records={history} contracts={state.contracts} installations={state.installations} region={regionFilter} selectedContract={selectedContract}/>} 
      {tab==="maestro"&&contract&&<Maestro contract={contract} history={contractHistory} budget={budget}/>} 
      {tab==="solicitudes"&&contract&&<Solicitudes contract={contract} installations={inst} requests={reqs} budget={budget} spent={spent} history={contractHistory} onNew={()=>setModal("req")}/>} 
      <div className="toolbar"><button className="btn danger" onClick={()=>{if(confirm("¿Restablecer datos editados y volver a la base V0.3?")){clearState();location.reload()}}}>Restablecer base V0.3</button></div>
    </main></div>
    {modal==="inst"&&contract&&<InstallationModal onClose={()=>setModal(null)} onSave={addInstallation}/>} 
    {editingInstallation&&<EditInstallationModal item={editingInstallation} onClose={()=>setEditingInstallation(null)} onSave={updateInstallation}/>} 
    {modal==="req"&&contract&&<RequestModal contract={contract} installations={inst.filter(x=>x.active)} available={available} history={contractHistory} onClose={()=>setModal(null)} onSave={addRequest}/>} 
  </div>
}

function Inicio({contracts,installations,requests,history,region,onOpen}:{contracts:Contract[];installations:Record<string,Installation[]>;requests:MaterialRequest[];history:HistoricalRecord[];region:string;onOpen:(id:string)=>void}){
  const filtered=contracts.filter(c=>region==="Todas"||c.region===region);
  const instCount=filtered.reduce((s,c)=>s+(installations[c.id]?.length||0),0);
  const hist=history.filter(h=>region==="Todas"||h.region===region);
  return <><h1 className="title">Control operativo por región y contrato</h1><p className="muted">La aplicación ya separa contratos, oficinas e histórico importado. Las direcciones quedan editables y los datos pendientes se identifican expresamente.</p>
  <div className="grid g4"><K label="Contratos / instituciones" value={filtered.length}/><K label="Instalaciones cargadas" value={instCount}/><K label="Registros históricos" value={hist.length}/><K label="Solicitudes nuevas" value={requests.filter(r=>filtered.some(c=>c.id===r.contractId)).length}/></div>
  <div className="sectionHead"><h2>Contratos e instituciones</h2></div><div className="tableWrap"><table><thead><tr><th>Región</th><th>Institución / contrato</th><th>Mercado Público</th><th>Instalaciones</th><th>Histórico</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map(c=><tr key={c.id}><td>{c.region}</td><td><b>{c.institution}</b><div className="small muted">{c.name.replace(/^Contrato /,"")}</div></td><td>{c.procurementId||"Pendiente"}</td><td>{installations[c.id]?.length||0}</td><td>{history.filter(h=>h.contractId===c.id).length}</td><td><span className={`pill ${c.statusLabel?.includes("confirmado")?"ok":"warn"}`}>{c.statusLabel||"Activo"}</span></td><td className="right"><button className="btn" onClick={()=>onOpen(c.id)}>Abrir</button></td></tr>)}</tbody></table></div></>
}

function K({label,value}:{label:string;value:string|number}){return <div className="card kpi"><span className="muted">{label}</span><b>{value}</b></div>}

function ContratoView({contract,budget,spent,available,pct,installations,requests,historical,onBudget}:{contract:Contract;budget:number;spent:number;available:number;pct:number;installations:number;requests:number;historical:number;onBudget:(n:number)=>void}){
  return <><h1 className="title">{contract.institution}</h1><p className="muted">{contract.region} · {contract.name.replace(/^Contrato /,"")}</p>
  <div className="grid g4"><K label="Presupuesto 4 meses" value={clp(budget)}/><K label="Consumido nuevas solicitudes" value={clp(spent)}/><K label="Disponible" value={clp(available)}/><K label="Instalaciones" value={installations}/></div>
  <div className="grid g2" style={{marginTop:14}}><div className="card"><h2 className="cardTitle">Ficha contractual</h2><Info label="Región" value={contract.region}/><Info label="ID Mercado Público" value={contract.procurementId||"Pendiente de cotejo"}/><Info label="Orden de compra" value={contract.purchaseOrder||"—"}/><Info label="Proveedor adjudicado" value={contract.provider||"Pendiente de cotejo"}/><Info label="Estado fuente" value={contract.statusLabel||"Base operativa"}/><Info label="Histórico importado" value={`${historical} registros`}/>{contract.sourceUrl&&<a className="sourceLink" href={contract.sourceUrl} target="_blank" rel="noreferrer">Abrir fuente Mercado Público</a>}</div>
  <div className="card"><h2 className="cardTitle">Servicios identificados</h2><div className="tagList">{(contract.services||[]).map(s=><span className="tag" key={s}>{s}</span>)}</div>{contract.monthlyNet? <Info label="Valor neto mensual registrado" value={clp(contract.monthlyNet)}/>:null}{contract.contractNet?<Info label="Valor neto contractual registrado" value={clp(contract.contractNet)}/>:null}<div className="field" style={{marginTop:16}}><label>Presupuesto global editable para materiales · 4 meses</label><input type="number" value={budget} onChange={e=>onBudget(Number(e.target.value)||0)}/></div><p className="small muted">Este presupuesto es el control de materiales. No reemplaza el valor total del contrato de servicios.</p></div></div>
  <div className="card" style={{marginTop:14}}><div className="bar"><span style={{width:`${pct}%`}}/></div><p className="small muted">Uso del presupuesto de materiales: {pct.toFixed(1)}% · {requests} solicitudes nuevas.</p></div></>
}

function Info({label,value}:{label:string;value:any}){return <div className="infoRow"><span>{label}</span><b>{value||"—"}</b></div>}

function Instalaciones({contract,items,historical,onAdd,onEdit,onToggle}:{contract:Contract;items:Installation[];historical:HistoricalRecord[];onAdd:()=>void;onEdit:(x:Installation)=>void;onToggle:(id:string)=>void}){
  return <><h1 className="title">Instalaciones</h1><p className="muted">{contract.institution} · {contract.region}. Dirección editable y trazabilidad de verificación.</p><div className="toolbar"><button className="btn primary" onClick={onAdd}>+ Agregar instalación</button></div>
  {!items.length?<div className="notice warning">Este contrato todavía no tiene instalaciones individualizadas. Se mantiene el contrato sin inventar oficinas.</div>:<div className="tableWrap"><table><thead><tr><th>Instalación</th><th>Comuna / ciudad</th><th>Dirección vigente</th><th>Tipo</th><th>Histórico</th><th>Verificación</th><th>Estado</th><th></th></tr></thead><tbody>{items.map(i=>{const hc=historical.filter(h=>sameInstallation(h.installationName,i.name)).length;return <tr key={i.id}><td><b>{i.name}</b></td><td>{i.commune||i.city||"—"}</td><td>{i.address||<span className="pill warn">Pendiente</span>}</td><td>{i.type||"—"}</td><td>{hc}</td><td><span className={`pill ${i.verification?.toLowerCase().includes("pendiente")?"warn":"ok"}`}>{i.verification||"Pendiente"}</span></td><td><span className={`pill ${i.active?"ok":""}`}>{i.active?"Activa":"Inactiva"}</span></td><td><div className="rowActions"><button className="btn" onClick={()=>onEdit(i)}>Editar</button><button className="btn" onClick={()=>onToggle(i.id)}>{i.active?"Desactivar":"Activar"}</button></div></td></tr>})}</tbody></table></div>}</>
}

function sameInstallation(a:string,b:string){const clean=(s:string)=>slug(s).replace(/direccion-regional-del-trabajo-la-araucania|direccion-regional/g,"direccion-regional");return clean(a)===clean(b)||clean(a).includes(clean(b))||clean(b).includes(clean(a))}

function Historico({records,contracts,installations,region,selectedContract}:{records:HistoricalRecord[];contracts:Contract[];installations:Record<string,Installation[]>;region:string;selectedContract:string}){
  const [scope,setScope]=useState("contrato"); const [search,setSearch]=useState("");
  const filtered=records.filter(r=>(region==="Todas"||r.region===region)&&(scope==="todos"||r.contractId===selectedContract)&&(!search||`${r.installationName} ${r.productName} ${r.institution}`.toLowerCase().includes(search.toLowerCase())));
  const qty=filtered.reduce((s,r)=>s+Number(r.quantity||0),0); const value=filtered.reduce((s,r)=>s+(Number(r.unitPriceNormalized||0)*Number(r.quantity||0)),0);
  return <><h1 className="title">Histórico importado</h1><p className="muted">Registros provenientes de TEMUCO, BIO BIO, ÑUBLE y LEBU. No se consideran inventario; son antecedentes/base de pedidos.</p>
  <div className="grid g4"><K label="Registros" value={filtered.length}/><K label="Unidades históricas" value={qty.toLocaleString("es-CL")}/><K label="Valorización referencial" value={clp(value)}/><K label="Fuentes" value={new Set(filtered.map(r=>r.sourceSheet)).size}/></div>
  <div className="toolbar"><select value={scope} onChange={e=>setScope(e.target.value)}><option value="contrato">Contrato seleccionado</option><option value="todos">Todos los contratos de la región</option></select><input placeholder="Buscar instalación o material" value={search} onChange={e=>setSearch(e.target.value)} /></div>
  <div className="tableWrap"><table><thead><tr><th>Región</th><th>Institución</th><th>Instalación/base</th><th>Material</th><th>Cantidad</th><th>Período</th><th>Precio ref.</th><th>Fuente</th></tr></thead><tbody>{filtered.slice(0,600).map(r=><tr key={r.id}><td>{r.region}</td><td>{r.institution}</td><td>{r.installationName}</td><td>{r.productName}</td><td>{r.quantity}</td><td>{r.period}</td><td>{r.unitPriceNormalized?clp(r.unitPriceNormalized):"—"}{r.priceNeedsReview&&<div><span className="pill warn">normalizado</span></div>}</td><td>{r.sourceSheet} · fila {r.sourceRow}</td></tr>)}</tbody></table></div>{filtered.length>600&&<p className="small muted">Mostrando los primeros 600 registros del filtro actual.</p>}</>
}

function Maestro({contract,history,budget}:{contract:Contract;history:HistoricalRecord[];budget:number}){
  const authNames=new Set(history.map(h=>h.productName.toLowerCase()));
  const contractProducts=products.filter(p=>authNames.has(p.name.toLowerCase()));
  return <><h1 className="title">Materiales del contrato</h1><p className="muted">El maestro general se cruza con el histórico del contrato. Los productos que aparecen en sus pedidos previos quedan identificados como utilizados.</p><div className="grid g4"><K label="Maestro general" value={products.length}/><K label="Usados históricamente" value={contractProducts.length}/><K label="Registros históricos" value={history.length}/><K label="Presupuesto 4 meses" value={clp(budget)}/></div>
  <div className="sectionHead"><h2>Productos</h2></div><div className="tableWrap"><table><thead><tr><th>Producto</th><th>Precio neto maestro</th><th>Base histórica contrato</th><th>Estado</th></tr></thead><tbody>{products.map((p:any)=>{const hr=history.filter(h=>h.productName.toLowerCase()===p.name.toLowerCase());const q=hr.reduce((s,h)=>s+h.quantity,0);return <tr key={p.id}><td><b>{p.name}</b></td><td>{p.price?clp(p.price):<span className="pill warn">Pendiente</span>}</td><td>{q||"—"}</td><td>{q?<span className="pill ok">Con histórico</span>:<span className="pill">Sin uso registrado</span>}</td></tr>})}</tbody></table></div></>
}

function Solicitudes({contract,installations,requests,budget,spent,history,onNew}:{contract:Contract;installations:Installation[];requests:MaterialRequest[];budget:number;spent:number;history:HistoricalRecord[];onNew:()=>void}){
  const avail=Math.max(0,budget-spent);return <><h1 className="title">Solicitudes por instalación</h1><p className="muted">La solicitud parte desde la instalación, su antecedente histórico y la revisión física del remanente.</p><div className="grid g4"><K label="Presupuesto 4 meses" value={clp(budget)}/><K label="Consumido" value={clp(spent)}/><K label="Disponible" value={clp(avail)}/><K label="Base histórica" value={history.length}/></div><div className="toolbar"><button className="btn primary" onClick={onNew} disabled={!installations.some(x=>x.active)}>+ Nueva solicitud</button>{!installations.some(x=>x.active)&&<span className="small muted">Primero se necesita una instalación activa.</span>}</div><div className="tableWrap"><table><thead><tr><th>Fecha</th><th>Instalación</th><th>Revisión física</th><th>Estado</th><th>Total</th><th>Observaciones</th></tr></thead><tbody>{requests.length?requests.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleDateString("es-CL")}</td><td>{installations.find(i=>i.id===r.installationId)?.name||"—"}</td><td><span className={`pill ${r.reviewed?"ok":"warn"}`}>{r.reviewed?"Revisada":"Sin revisión"}</span></td><td>{r.status}</td><td>{clp(r.total)}</td><td>{r.notes||"—"}</td></tr>):<tr><td colSpan={6} className="muted">Sin solicitudes nuevas todavía. El histórico importado se consulta en la pestaña Histórico.</td></tr>}</tbody></table></div></>
}

function InstallationModal({onClose,onSave}:{onClose:()=>void;onSave:(x:any)=>void}){const [f,setF]=useState({name:"",city:"",commune:"",address:"",type:"Instalación",verification:"Ingreso manual",source:"Aplicación",editable:true});return <div className="modalBg"><div className="modal"><h2>Nueva instalación</h2><div className="grid g2">{Object.entries({name:"Nombre instalación",city:"Ciudad",commune:"Comuna",address:"Dirección",type:"Tipo",verification:"Estado de verificación"}).map(([k,l])=><div className="field" key={k}><label>{l}</label><input value={(f as any)[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></div>)}</div><div className="toolbar"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!f.name.trim()} onClick={()=>onSave(f)}>Guardar instalación</button></div></div></div>}

function EditInstallationModal({item,onClose,onSave}:{item:Installation;onClose:()=>void;onSave:(x:Installation)=>void}){const [f,setF]=useState({...item});return <div className="modalBg"><div className="modal"><h2>Editar instalación</h2><p className="small muted">La dirección puede corregirse cuando cambie o se valide una fuente más reciente.</p><div className="grid g2">{Object.entries({name:"Nombre",city:"Ciudad",commune:"Comuna",address:"Dirección vigente",type:"Tipo",verification:"Verificación / nota"}).map(([k,l])=><div className="field" key={k}><label>{l}</label><input value={String((f as any)[k]||"")} onChange={e=>setF({...f,[k]:e.target.value})}/></div>)}</div><div className="toolbar"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={()=>onSave(f)}>Guardar cambios</button></div></div></div>}

function RequestModal({contract,installations,available,history,onClose,onSave}:{contract:Contract;installations:Installation[];available:number;history:HistoricalRecord[];onClose:()=>void;onSave:(r:MaterialRequest)=>void}){
  const [installationId,setInstallationId]=useState(installations[0]?.id||"");
  const [reviewed,setReviewed]=useState(false);
  const [reviewDate,setReviewDate]=useState(new Date().toISOString().slice(0,10));
  const [notes,setNotes]=useState("");
  const selectedInst=installations.find(i=>i.id===installationId);
  const baseByProduct=useMemo(()=>{
    const m=new Map<string,number>();
    if(!selectedInst)return m;
    history.filter(h=>sameInstallation(h.installationName,selectedInst.name)).forEach(h=>m.set(h.productName.toLowerCase(),(m.get(h.productName.toLowerCase())||0)+h.quantity));
    return m;
  },[installationId,selectedInst,history]);
  const initialLines=()=>products.filter(p=>baseByProduct.has(p.name.toLowerCase())).slice(0,30).map(p=>{
    const base=baseByProduct.get(p.name.toLowerCase())||0;
    return {productId:p.id,productName:p.name,unitPrice:p.price,baseQty:base,remainder:0,requestedQty:base,lineTotal:(p.price||0)*base};
  });
  const fallbackLines=()=>products.slice(0,15).map(p=>({productId:p.id,productName:p.name,unitPrice:p.price,baseQty:0,remainder:0,requestedQty:0,lineTotal:0}));
  const [lines,setLines]=useState<RequestLine[]>(()=>initialLines().length?initialLines():fallbackLines());
  useEffect(()=>{const n=initialLines();setLines(n.length?n:fallbackLines())},[installationId]);
  const total=lines.reduce((s,l)=>s+l.lineTotal,0);
  const updateRemainder=(idx:number,v:number)=>setLines(ls=>ls.map((l,i)=>{
    if(i!==idx)return l;
    const remainder=Math.max(0,v);
    const requestedQty=Math.max(0,(l.baseQty||0)-remainder);
    return {...l,remainder,requestedQty,lineTotal:(l.unitPrice||0)*requestedQty};
  }));
  const updateRequested=(idx:number,v:number)=>setLines(ls=>ls.map((l,i)=>i===idx?{...l,requestedQty:Math.max(0,v),lineTotal:(l.unitPrice||0)*Math.max(0,v)}:l));
  const can=reviewed&&installationId&&total>0&&(available===0||total<=available);
  return <div className="modalBg"><div className="modal requestModal">
    <div className="requestHeader">
      <div><div className="eyebrow">NUEVA SOLICITUD</div><h2>{contract.institution}</h2><p>{selectedInst?.name||"Selecciona una instalación"}</p></div>
      <button className="iconBtn" onClick={onClose} aria-label="Cerrar">×</button>
    </div>
    <div className="requestIntro"><b>Automático:</b> ingresa únicamente el remanente físico. El sistema calcula <b>Base histórica − Remanente = Solicitar</b>. La cantidad sugerida queda editable si necesitas hacer una corrección excepcional.</div>
    <div className="requestControls">
      <div className="field"><label>Instalación</label><select value={installationId} onChange={e=>setInstallationId(e.target.value)}>{installations.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
      <div className="field"><label>Fecha de revisión</label><input type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/></div>
      <label className={`reviewCheck ${reviewed?"checked":""}`}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span><b>Revisión física realizada</b><small>Confirmo que revisé los materiales disponibles en la instalación.</small></span></label>
    </div>
    <div className="requestTableWrap"><table className="requestTable"><thead><tr><th>Material</th><th className="num">Base 4 meses</th><th className="num">Precio</th><th className="num focusCol">Remanente físico</th><th className="num autoCol">Solicitar automáticamente</th><th className="num">Total</th></tr></thead><tbody>{lines.map((l,i)=><tr key={l.productId}><td><b>{l.productName}</b></td><td className="num baseCell">{l.baseQty||"—"}</td><td className="num">{l.unitPrice?clp(l.unitPrice):"Pendiente"}</td><td className="num focusCol"><input className="qtyInput" type="number" min={0} value={l.remainder} onChange={e=>updateRemainder(i,Number(e.target.value)||0)}/></td><td className="num autoCol"><div className="autoQty"><input className="qtyInput suggested" type="number" min={0} value={l.requestedQty} onChange={e=>updateRequested(i,Number(e.target.value)||0)}/><span>Auto</span></div></td><td className="num totalCell">{clp(l.lineTotal)}</td></tr>)}</tbody></table></div>
    <div className="requestFooter">
      <div className="field notesField"><label>Observaciones</label><textarea rows={3} placeholder="Solo si existe una situación especial..." value={notes} onChange={e=>setNotes(e.target.value)}/></div>
      <div className="requestSummary"><span>Total solicitud</span><strong>{clp(total)}</strong><small>{available?`Saldo disponible: ${clp(available)}`:"Contrato sin presupuesto cargado"}</small>{available>0&&total>available&&<div className="inlineWarning">Supera el saldo disponible.</div>}</div>
    </div>
    <div className="requestActions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary large" disabled={!can} onClick={()=>onSave({id:crypto.randomUUID(),contractId:contract.id,installationId,createdAt:new Date().toISOString(),reviewed,reviewDate,notes,lines:lines.filter(l=>l.requestedQty>0),total,status:"Solicitada"})}>Confirmar solicitud</button></div>
  </div></div>
}

