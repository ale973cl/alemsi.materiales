"use client";
import type {ClientProfile,MaterialState} from "@/lib/materiales-domain";
import {activeCampaign,campaignSurveys,clp,consolidatedFor} from "@/lib/materiales-store";
import {Kpi,Progress} from "../Common";
export default function HomeModule({state,profile}:{state:MaterialState;profile:ClientProfile}){
 const c=activeCampaign(state,profile.id),s=campaignSurveys(state,c),expected=c?.expectedInstallationIds.length||profile.installations.filter(i=>i.active!==false).length,done=new Set(s.filter(x=>x.status==="Confirmado").map(x=>x.installationId)).size,net=consolidatedFor(state,c).reduce((a,b)=>a+b.net,0);
 return <><h1>{profile.institution}</h1><p className="lead">{profile.region} · Circuito completo de materiales</p><div className="grid g4"><Kpi label="Instalaciones" value={expected}/><Kpi label="Levantadas" value={done}/><Kpi label="Carencia neta" value={clp(net)}/><Kpi label="Rol" value={state.role}/></div><div className="card sectionCard"><h2>Avance</h2><Progress done={done} total={expected}/></div><div className="flow">{["Clientes","Maestro","Levantamiento","Cotejo","Consolidado","Kits","OC","Ingreso","Guías"].map((x,i)=><div className="flowStep" key={x}><span>{i+1}</span><b>{x}</b></div>)}</div>{state.role==="Supervisora"&&<div className="notice"><b>Vista de terreno:</b> entra a Levantamiento, registra cuánto queda y confirma.</div>}</>;
}
