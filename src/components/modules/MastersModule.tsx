"use client";
import {useMemo,useState} from "react";
import MaterialsCatalogModule,{type MaterialCatalogRow} from "./MaterialsCatalogModule";
import ClientInstallationsModule,{type ClientInstallationGroup} from "./ClientInstallationsModule";
import SuppliersModule from "./SuppliersModule";
import UsersModule,{type UserAccessRow,type UserProfileRow} from "./UsersModule";

type StatusFilter="active"|"inactive"|"all";
type MasterTab="materials"|"clients"|"suppliers"|"users";

type Props={
 role:string;
 materials:MaterialCatalogRow[];
 materialSourceCount:number;
 materialError?:string|null;
 clients:ClientInstallationGroup[];
 users:UserProfileRow[];
 access:UserAccessRow[];
 currentUserId:string;
};

const labels:Record<MasterTab,string>={materials:"Materiales",clients:"Clientes",suppliers:"Proveedores",users:"Usuarios y perfiles"};

export default function MastersModule({role,materials,materialSourceCount,materialError,clients,users,access,currentUserId}:Props){
 const allowed=useMemo<MasterTab[]>(()=>{
  if(role==="Admin Total")return["materials","clients","suppliers","users"];
  if(role==="Gerencia"||role==="Admin")return["materials","clients","suppliers"];
  return["materials"];
 },[role]);
 const [tab,setTab]=useState<MasterTab>(allowed[0]||"materials");
 const [status,setStatus]=useState<StatusFilter>("active");
 const changeTab=(next:MasterTab)=>{setTab(next);setStatus("active")};
 return <div className="mastersHub">
  <section className="panel mastersHubNav">
   <div className="catalogIntro"><div><p className="eyebrow">CONFIGURACIÓN CENTRAL</p><h2>Maestros</h2><p>Crea, corrige, activa o desactiva los datos base sin salir de esta área.</p></div></div>
   <div className="mastersPrimaryTabs">{allowed.map(item=><button key={item} type="button" className={tab===item?"active":""} onClick={()=>changeTab(item)}>{labels[item]}</button>)}</div>
   <div className="mastersStatusTabs" aria-label="Estado del maestro"><button type="button" className={status==="active"?"active":""} onClick={()=>setStatus("active")}>Activos</button><button type="button" className={status==="inactive"?"active":""} onClick={()=>setStatus("inactive")}>Desactivados</button><button type="button" className={status==="all"?"active":""} onClick={()=>setStatus("all")}>Todos</button></div>
  </section>
  {tab==="materials"&&<MaterialsCatalogModule rows={materials} sourceCount={materialSourceCount} error={materialError} statusFilter={status}/>} 
  {tab==="clients"&&<ClientInstallationsModule clients={clients} statusFilter={status} hideMasterSwitch/>}
  {tab==="suppliers"&&<SuppliersModule statusFilter={status}/>} 
  {tab==="users"&&<UsersModule users={users} clients={clients.filter(c=>c.active!==false)} access={access} currentUserId={currentUserId} statusFilter={status}/>} 
 </div>;
}
