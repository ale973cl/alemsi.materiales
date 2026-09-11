"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import ClientInstallationsModule,{type ClientInstallationGroup} from "./ClientInstallationsModule";
import ClientCsvImportPanel from "./ClientCsvImportPanel";
import {createClientContract} from "@/app/client-structure-actions";

const norm=(v:unknown)=>String(v??"").trim().toLocaleLowerCase("es-CL");

export default function ClientsMasterView({clients}:{clients:ClientInstallationGroup[]}){
 const [search,setSearch]=useState("");
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [showNew,setShowNew]=useState(false);
 const focusRef=useRef<HTMLDivElement|null>(null);
 const selected=useMemo(()=>clients.find(c=>c.id===selectedId)||null,[clients,selectedId]);
 const visible=useMemo(()=>{
  const q=norm(search);
  if(!q)return clients;
  return clients.filter(c=>[c.legal_name,c.rut,c.business_center].some(v=>norm(v).includes(q))||(c.contracts||[]).some(k=>norm(k.name).includes(q)||(k.installations||[]).some(i=>[i.name,i.region,i.city,i.commune,i.address].some(v=>norm(v).includes(q)))));
 },[clients,search]);
 useEffect(()=>{
  if(!selected||!focusRef.current)return;
  const details=focusRef.current.querySelectorAll("details");
  details.forEach(d=>{d.open=true});
 },[selected]);
 if(selected){
  return <div ref={focusRef} className="clientFocusedMaster">
   <style dangerouslySetInnerHTML={{__html:`
    .clientFocusedMaster>.focusHead{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 12px;padding:14px 16px;border:1px solid #c8dce8;border-radius:12px;background:#fff}.focusHead h2{margin:0;color:#0b2f4a}.focusHead p{margin:4px 0 0;color:#557084}.clientFocusedMaster .clientCore>.catalogIntro,.clientFocusedMaster .clientCore>.coreToolbar,.clientFocusedMaster .clientCore>.clientCsvImport,.clientFocusedMaster .clientCore>.consolidatedViewSwitch{display:none!important}.clientFocusedMaster .clientCore{margin-top:0}.clientFocusedMaster .clientGroup{border:0!important;background:transparent!important}.clientFocusedMaster .clientGroup>summary{display:none!important}.clientFocusedMaster .clientGroups{display:block!important}.clientFocusedMaster .contractGroups{padding-top:0!important}
   `}}/>
   <div className="focusHead"><div><button type="button" className="backButton" onClick={()=>setSelectedId(null)}>← Volver a clientes</button><h2>{selected.legal_name}</h2><p>{[selected.rut,selected.business_center].filter(Boolean).join(" · ")||"Datos del cliente"}</p></div><span className="catalogCount">{selected.contracts.reduce((n,c)=>n+(c.installations||[]).length,0)} instalaciones</span></div>
   <ClientInstallationsModule clients={[selected]}/>
  </div>;
 }
 return <section className="panel clientMasterIndex">
  <style dangerouslySetInnerHTML={{__html:`
   .clientMasterIndex .clientIndexToolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:12px 0}.clientMasterIndex .clientIndexToolbar label{display:grid;gap:5px;flex:1 1 360px;font-weight:700;color:#173650}.clientMasterIndex .clientIndexToolbar input{width:100%;box-sizing:border-box}.clientCardGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.clientCardGrid button{display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-height:118px;padding:16px;text-align:left;border:1px solid #c8dce8;border-radius:12px;background:#fff;color:#173650;cursor:pointer}.clientCardGrid button:hover{border-color:#79bdb1;box-shadow:0 5px 18px rgba(11,47,74,.08)}.clientCardGrid b{font-size:15px}.clientCardGrid small{color:#557084}.clientCardGrid .count{margin-top:auto;align-self:flex-end;padding:5px 9px;border-radius:999px;background:#e4f5f1;color:#07594f;font-weight:800}@media(max-width:1000px){.clientCardGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.clientCardGrid{grid-template-columns:1fr}}
  `}}/>
  <div className="catalogIntro"><div><h2>Clientes e instalaciones</h2><p>Selecciona un cliente para trabajar exclusivamente con su información, contratos e instalaciones.</p></div><span className="catalogCount">{clients.length} clientes</span></div>
  <div className="clientIndexToolbar"><label>Buscar cliente<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Razón social, RUT, contrato o instalación..."/></label>{search&&<button type="button" className="clearFilters" onClick={()=>setSearch("")}>Limpiar</button>}<button type="button" onClick={()=>setShowNew(v=>!v)}>+ Nuevo cliente</button></div>
  <ClientCsvImportPanel/>
  {showNew&&<form action={createClientContract} className="adminForm"><h3>Crear cliente y contrato inicial</h3><input name="legal_name" required placeholder="Razón social / cliente"/><input name="rut" placeholder="RUT"/><input name="contract_name" required placeholder="Nombre contrato / región"/><input name="business_center" placeholder="Centro de negocio"/><input name="net_budget" type="number" min="0" placeholder="Flujo económico mensual autorizado"/><button>Guardar cliente</button></form>}
  <div className="clientCardGrid">{visible.map(client=>{const installs=(client.contracts||[]).reduce((n,c)=>n+(c.installations||[]).length,0);return <button type="button" key={client.id} onClick={()=>setSelectedId(client.id)}><b>{client.legal_name}</b><small>{[client.rut,client.business_center].filter(Boolean).join(" · ")||"Datos por completar"}</small><small>{client.contracts?.length||0} contrato{(client.contracts?.length||0)===1?"":"s"}</small><span className="count">{installs} instalación{installs===1?"":"es"}</span></button>})}</div>
  {!visible.length&&<div className="empty"><b>Sin coincidencias</b><span>Prueba con otro nombre, RUT, contrato o instalación.</span></div>}
 </section>;
}
