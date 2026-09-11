"use client";
import {useMemo,useState} from "react";
import MaterialsCatalogModule,{type MaterialCatalogRow} from "./MaterialsCatalogModule";
import ClientInstallationsModule,{type ClientInstallationGroup} from "./ClientInstallationsModule";
import SuppliersModule from "./SuppliersModule";
import UsersModule,{type UserAccessRow,type UserProfileRow} from "./UsersModule";

export type MasterStatusFilter="active"|"inactive"|"all";
type MasterTab="materials"|"clients"|"suppliers"|"users";
type MaterialMasterRow=MaterialCatalogRow&{active?:boolean};
type ClientMasterGroup=ClientInstallationGroup&{active?:boolean};

type Props={
 role:string;
 materials:MaterialMasterRow[];
 materialSourceCount:number;
 materialError?:string|null;
 clients:ClientMasterGroup[];
 users:UserProfileRow[];
 access:UserAccessRow[];
 currentUserId:string;
};

const labels:Record<MasterTab,string>={materials:"Materiales",clients:"Clientes",suppliers:"Proveedores",users:"Usuarios y perfiles"};
const descriptions:Record<MasterTab,string>={materials:"Catálogo, precios, proveedores y carga CSV",clients:"Clientes, contratos, instalaciones y perfiles",suppliers:"Datos tributarios, contactos y condiciones de compra",users:"Usuarios, perfiles, permisos y asignaciones"};
const byStatus=<T extends {active?:boolean}>(rows:T[],status:MasterStatusFilter)=>status==="all"?rows:rows.filter(row=>status==="active"?row.active!==false:row.active===false);

export default function MastersModule({role,materials,materialSourceCount,materialError,clients,users,access,currentUserId}:Props){
 const allowed=useMemo<MasterTab[]>(()=>{
  if(role==="Admin Total")return["materials","clients","suppliers","users"];
  if(role==="Gerencia"||role==="Admin")return["materials","clients","suppliers"];
  return["materials"];
 },[role]);
 const [tab,setTab]=useState<MasterTab|null>(null);
 const [status,setStatus]=useState<MasterStatusFilter>("active");
 const filteredMaterials=useMemo(()=>byStatus(materials,status),[materials,status]);
 const filteredClients=useMemo(()=>byStatus(clients,status),[clients,status]);
 const filteredUsers=useMemo(()=>byStatus(users,status),[users,status]);
 const changeTab=(next:MasterTab)=>{setTab(next);setStatus("active")};
 return <div className="mastersHub">
  <style dangerouslySetInnerHTML={{__html:`
   .mastersHubNav{padding-bottom:14px}.mastersPrimaryTabs,.mastersStatusTabs{display:flex;gap:8px;flex-wrap:wrap}.mastersPrimaryTabs{margin-top:12px;padding-top:12px;border-top:1px solid #dbe7ec}.mastersStatusTabs{margin-top:10px}.mastersPrimaryTabs button,.mastersStatusTabs button{border:1px solid #bfd3df;background:#fff;color:#173650;border-radius:999px;padding:9px 14px;font-weight:700}.mastersPrimaryTabs button.active{background:#0b2f4a;color:#fff;border-color:#0b2f4a}.mastersStatusTabs button.active{background:#e4f5f1;color:#07594f;border-color:#79bdb1}.mastersHub .clientCore>.consolidatedViewSwitch,.mastersHub .clientCore .clientMasterSwitch{display:none!important}.mastersLanding{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mastersLanding button{display:grid;gap:5px;text-align:left;padding:20px;border:1px solid #c8dce8;border-radius:14px;background:#fff;color:#173650}.mastersLanding button:hover{border-color:#5daea2;background:#f6fbfa}.mastersLanding button b{font-size:17px;color:#0b2f4a}.mastersLanding button span{font-size:13px;line-height:1.4;color:#557084}@media(max-width:700px){.mastersPrimaryTabs button,.mastersStatusTabs button{flex:1 1 auto}.mastersLanding{grid-template-columns:1fr}}
  `}}/>
  <section className="panel mastersHubNav">
   <div className="catalogIntro"><div><p className="eyebrow">CONFIGURACIÓN CENTRAL</p><h2>Maestros</h2><p>Crea, corrige, agrega, actualiza, activa o desactiva los datos base sin salir de esta área.</p></div></div>
   <div className="mastersPrimaryTabs">{allowed.map(item=><button key={item} type="button" className={tab===item?"active":""} onClick={()=>changeTab(item)}>{labels[item]}</button>)}</div>
   {tab&&<div className="mastersStatusTabs" aria-label="Estado del maestro"><button type="button" className={status==="active"?"active":""} onClick={()=>setStatus("active")}>Activos</button><button type="button" className={status==="inactive"?"active":""} onClick={()=>setStatus("inactive")}>Desactivados</button><button type="button" className={status==="all"?"active":""} onClick={()=>setStatus("all")}>Todos</button></div>}
  </section>
  {!tab&&<section className="panel"><div className="mastersLanding">{allowed.map(item=><button key={item} type="button" onClick={()=>changeTab(item)}><b>{labels[item]}</b><span>{descriptions[item]}</span></button>)}</div></section>}
  {tab==="materials"&&<MaterialsCatalogModule rows={filteredMaterials} sourceCount={status==="active"?materialSourceCount:filteredMaterials.length} error={materialError}/>} 
  {tab==="clients"&&<ClientInstallationsModule clients={filteredClients}/>} 
  {tab==="suppliers"&&<SuppliersModule statusFilter={status}/>} 
  {tab==="users"&&<UsersModule users={filteredUsers} clients={clients.filter(c=>c.active!==false)} access={access} currentUserId={currentUserId}/>} 
 </div>;
}
