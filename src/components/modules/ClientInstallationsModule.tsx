"use client";

import {useMemo,useState} from "react";

type Installation={id:string;name:string;region?:string|null;city?:string|null;commune?:string|null;active?:boolean};
type Contract={id:string;name:string;code?:string|null;installations:Installation[]};
export type ClientInstallationGroup={id:string;legal_name:string;business_center?:string|null;contracts:Contract[]};
const clean=(value:unknown)=>String(value??"").trim();
const normalized=(value:unknown)=>clean(value).toLocaleLowerCase("es-CL");

export default function ClientInstallationsModule({clients}:{clients:ClientInstallationGroup[]}){
 const [search,setSearch]=useState("");
 const rows=useMemo(()=>clients.map(client=>({...client,contracts:(client.contracts||[]).map(contract=>({...contract,installations:(contract.installations||[]).filter(item=>!search||[client.legal_name,contract.name,item.name,item.region,item.city,item.commune].some(value=>normalized(value).includes(normalized(search))))})).filter(contract=>!search||normalized(client.legal_name).includes(normalized(search))||normalized(contract.name).includes(normalized(search))||contract.installations.length)})).filter(client=>!search||normalized(client.legal_name).includes(normalized(search))||client.contracts.length),[clients,search]);
 const installationCount=clients.reduce((sum,client)=>sum+client.contracts.reduce((inner,contract)=>inner+contract.installations.length,0),0);
 return <section className="panel clientCore">
  <div className="catalogIntro"><div><h2>Clientes e instalaciones</h2><p>Núcleo único: cada cliente contiene sus contratos y, dentro de ellos, sus instalaciones.</p></div><span className="catalogCount">{clients.length} clientes · {installationCount} instalaciones</span></div>
  <div className="coreToolbar"><label>Buscar cliente o instalación<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Ej.: Dirección del Trabajo, Curanilahue, Registro Civil"/></label>{search&&<button type="button" className="clearFilters" onClick={()=>setSearch("")}>Limpiar</button>}</div>
  <div className="clientGroups">{rows.map(client=>{const count=client.contracts.reduce((sum,contract)=>sum+contract.installations.length,0);return <details className="clientGroup" key={client.id} open={Boolean(search)}><summary><span><b>{client.legal_name}</b><small>{client.business_center||"Centro de negocio pendiente"}</small></span><em>{count} {count===1?"instalación":"instalaciones"}</em></summary><div className="contractGroups">{client.contracts.length?client.contracts.map(contract=><div className="contractGroup" key={contract.id}><div className="contractTitle"><span><b>{contract.name}</b>{contract.code&&<small>Código: {contract.code}</small>}</span><span className="linkedState">Asociado</span></div>{contract.installations.length?<div className="installationGrid">{contract.installations.map(item=><article key={item.id} className={normalized(item.name)==="prueba"?"needsReview":""}><div><b>{item.name}</b><small>{[item.commune,item.city,item.region].filter(Boolean).join(" · ")||"Ubicación pendiente"}</small></div><span>{normalized(item.name)==="prueba"?"Revisar nombre":"Activa"}</span></article>)}</div>:<div className="associationPending"><b>Sin instalaciones asociadas</b><span>Este cliente queda visible para agregar o asociar instalaciones posteriormente.</span></div>}</div>):<div className="associationPending"><b>Sin contrato asociado</b><span>Requiere revisión antes de crear instalaciones.</span></div>}</div></details>})}</div>
  {!rows.length&&<div className="empty"><b>Sin coincidencias</b><span>Prueba otro cliente, región, comuna o instalación.</span></div>}
  <p className="catalogNote">Las asociaciones mostradas provienen de Supabase. Los nombres dudosos quedan marcados para revisión; no se renombran ni reasignan automáticamente sin trazabilidad.</p>
 </section>
}
