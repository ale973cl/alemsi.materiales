"use client";
import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/actions";
import { saveSurveyWithTrace } from "@/app/survey-actions";
import MastersModule from "@/components/modules/MastersModule";
import {type MaterialCatalogRow} from "@/components/modules/MaterialsCatalogModule";
import {type ClientInstallationGroup} from "@/components/modules/ClientInstallationsModule";
import {type UserAccessRow,type UserProfileRow} from "@/components/modules/UsersModule";
import DispatchDeliveryModule from "@/components/modules/DispatchDeliveryModule";
import CampaignsModule from "@/components/modules/CampaignsModule";
import ConsolidatedSupplyModule from "@/components/modules/ConsolidatedSupplyModule";
import CampaignPendingModule from "@/components/modules/CampaignPendingModule";
import ConnectedReceiptModule from "@/components/modules/ConnectedReceiptModule";
import SurveyLinkControl from "@/components/modules/SurveyLinkControl";
import InventoryModule from "@/components/modules/InventoryModule";
type MasterMaterialRow=MaterialCatalogRow&{active?:boolean};type MasterClientGroup=ClientInstallationGroup&{active?:boolean};
type Props={initialTab?:string;profile:any;summary:Record<string,number>;campaigns:any[];activeCampaigns:any[];consolidatedSurveys:any[];orders:any[];dispatches:any[];audit:any[];materialCatalog:MaterialCatalogRow[];materialCatalogSourceCount:number;materialCatalogError?:string|null;masterMaterialCatalog:MasterMaterialRow[];clientInstallations:ClientInstallationGroup[];masterClientInstallations:MasterClientGroup[];users:UserProfileRow[];userInstallationAccess:UserAccessRow[]};
const titles:Record<string,string>={inicio:"Inicio",clientes:"Administración",campañas:"Planificación",levantamientos:"Levantamientos",consolidado:"Abastecimiento y compras",preparacion:"Preparación",inventario:"Bodega e inventario",compras:"Documentos de compra",recepcion:"Recepción de mercadería",entregas:"Despachos y entregas"};
const mainNav=[["campañas","Planificación"],["consolidado","Abastecimiento"],["inventario","Bodega"],["entregas","Entregas"],["clientes","Administración"]] as const;
const quickLinks:Record<string,[string,string][]>={
 campañas:[["campañas","Campañas"],["levantamientos","Levantamientos"]],
 consolidado:[["consolidado","Necesidades / comprar"],["compras","Cotizaciones y OC"],["recepcion","Recepción"]],
 inventario:[["inventario","Existencias"],["preparacion","Preparación"]],
 entregas:[["entregas","Guías y entregas"]],
 clientes:[["clientes","Maestros y configuración"]]
};
const parentOf=(tab:string)=>tab==="levantamientos"?"campañas":tab==="compras"||tab==="recepcion"?"consolidado":tab==="preparacion"?"inventario":tab;
export default function OperationalApp({initialTab,profile,summary,campaigns,activeCampaigns,consolidatedSurveys,orders,dispatches,materialCatalog,materialCatalogSourceCount,materialCatalogError,masterMaterialCatalog,clientInstallations,masterClientInstallations,users,userInstallationAccess}:Props){
 const router=useRouter();
 const [isNavigating,startTransition]=useTransition();
 const allowed=Object.keys(titles);
 const [tab,setTab]=useState(initialTab&&allowed.includes(initialTab)?initialTab:"inicio");
 const [selectedCampaignId,setSelectedCampaignId]=useState("");
 const [selectedSurveyInstallationId,setSelectedSurveyInstallationId]=useState("");
 useEffect(()=>{const params=new URLSearchParams(window.location.search),target=initialTab&&allowed.includes(initialTab)?initialTab:(params.get("vista")||"inicio");setTab(allowed.includes(target)?target:"inicio");setSelectedCampaignId(params.get("campana")||"");setSelectedSurveyInstallationId(params.get("instalacion")||"")},[initialTab]);
 const navigate=(next:string)=>{if(!allowed.includes(next)||next===tab)return;const url=next==="inicio"?"/":`/?vista=${encodeURIComponent(next)}`;startTransition(()=>router.push(url,{scroll:true}))};
 const openSurveyScreen=(campaignId:string,installationId="")=>{const q=new URLSearchParams({vista:"levantamientos"});if(campaignId)q.set("campana",campaignId);if(installationId)q.set("instalacion",installationId);startTransition(()=>router.push(`/?${q.toString()}`,{scroll:true}))};
 const parent=parentOf(tab);
 const currentLinks=quickLinks[parent]||[];
 const navTitle=titles[tab]||"Inicio";
 return <div className="portal simpleApp">
  <header className="portalTop simpleTop"><button type="button" className="simpleLogoButton" onClick={()=>navigate("inicio")} aria-label="Ir al inicio"><Image src="/alemsi-logo.png" width={170} height={67} alt="ALEMSI" priority/></button><div className="simpleTopRight"><span>Control de materiales</span><form action={signOut}><button className="linkBtn">Salir</button></form></div></header>
  <div className="portalBody simpleBody"><aside className="simpleSidebar"><div className="productTitle">ALEMSI<small>Operación de materiales</small></div><button type="button" className={tab==="inicio"?"nav active":"nav"} onClick={()=>navigate("inicio")}>Inicio</button>{mainNav.map(([id,name],i)=><button type="button" key={id} className={parent===id?"nav active":"nav"} onClick={()=>navigate(id)}><span className="simpleNavNumber">0{i+1}</span>{name}</button>)}</aside>
  <main className="workspace simpleWorkspace">
   {isNavigating&&<div className="navigationProgress" role="status" aria-live="polite"><span className="navigationProgressDot"/>Cargando vista…</div>}
   <div className="simplePageHead"><div><p className="eyebrow">ALEMSI · OPERACIÓN</p><h1>{navTitle}</h1></div>{tab!=="inicio"&&<button type="button" className="simpleBack" onClick={()=>navigate("inicio")}>← Inicio</button>}</div>
   {currentLinks.length>0&&<nav className="simpleSubnav" aria-label="Vistas de trabajo">{currentLinks.map(([id,name])=><button key={id} type="button" className={tab===id?"active":""} onClick={()=>navigate(id)}>{name}</button>)}</nav>}
   {tab==="inicio"&&<><p className="simpleLead">Continúa por el proceso o entra directamente a una tarea.</p><section className="simpleHomeGrid">{mainNav.map(([id,name],i)=><button key={id} className="simpleHomeTile" type="button" onClick={()=>navigate(id)}><span className="simpleTileNumber">0{i+1}</span><strong>{name}</strong><span className="simpleTileArrow">→</span></button>)}</section><section className="simpleSummary"><span>Campañas abiertas <b>{summary.openCampaigns}</b></span><span>Levantamientos pendientes <b>{summary.pendingSurveys}</b></span><span>Entregas pendientes <b>{summary.openDispatches}</b></span></section></>}
   {tab==="clientes"&&<MastersModule role={profile.role} materials={masterMaterialCatalog} materialSourceCount={materialCatalogSourceCount} materialError={materialCatalogError} clients={masterClientInstallations} campaigns={campaigns} users={users} access={userInstallationAccess} currentUserId={profile.id}/>}
   {tab==="campañas"&&<CampaignsModule campaigns={campaigns} clients={clientInstallations} onOpenSurveys={(campaignId,installationId)=>openSurveyScreen(campaignId,installationId||"")}/>}
   {tab==="levantamientos"&&<SurveyCampaignSelector campaigns={activeCampaigns} surveys={consolidatedSurveys} selectedCampaignId={selectedCampaignId} selectedInstallationId={selectedSurveyInstallationId} onOpen={(campaignId,installationId)=>openSurveyScreen(campaignId,installationId||"")} onBack={()=>openSurveyScreen(selectedCampaignId)} onNextNeed={()=>navigate("consolidado")}/>}
   {tab==="consolidado"&&<ConsolidatedSupplyModule surveys={consolidatedSurveys} initialView="need"/>}
   {tab==="inventario"&&<InventoryModule role={profile.role}/>}
   {tab==="compras"&&<ConsolidatedSupplyModule surveys={consolidatedSurveys} initialView="documents"/>}
   {tab==="recepcion"&&<ConnectedReceiptModule role={profile.role}/>}
   {tab==="preparacion"&&<CampaignPendingModule surveys={consolidatedSurveys} dispatches={dispatches}/>}
   {tab==="entregas"&&<DispatchDeliveryModule dispatches={dispatches} campaigns={campaigns} clients={clientInstallations} materials={materialCatalog} role={profile.role} users={users} currentUser={{id:profile.id,full_name:profile.full_name}}/>}
  </main></div></div>
}
function Empty(){return <div className="empty"><b>Sin registros disponibles</b><span>El módulo está conectado y respetará los permisos RLS del usuario.</span></div>}
function SurveyCampaignSelector({campaigns,surveys,selectedCampaignId,selectedInstallationId,onOpen,onBack,onNextNeed}:{campaigns:any[];surveys:any[];selectedCampaignId:string;selectedInstallationId:string;onOpen:(campaignId:string,installationId?:string)=>void;onBack:()=>void;onNextNeed:()=>void}){
 const [region,setRegion]=useState("");
 const selected=campaigns.find(c=>c.id===selectedCampaignId)||null;
 if(!selected){
  return <section className="panel surveyCampaignSelector"><div className="catalogIntro"><div><h2>Levantamientos</h2><p>Abre una campaña para ver sus instalaciones. El conteo se realiza en una pantalla independiente.</p></div></div><div className="surveyCampaignQuickList">{campaigns.map(c=>{const rows=c.campaign_installations||[],done=rows.filter((x:any)=>x.status==="Completada"||surveys.some((s:any)=>s.campaign_id===c.id&&s.installation_id===x.installation_id)).length;return <button type="button" key={c.id} onClick={()=>onOpen(c.id)}><span><b>{parseCampaignLabel(c.label).name}</b><small>{done}/{rows.length} instalaciones completadas</small></span><strong>Abrir →</strong></button>})}{!campaigns.length&&<Empty/>}</div></section>;
 }
 const installations=selected.campaign_installations||[];
 const selectedRow=installations.find((x:any)=>x.installation_id===selectedInstallationId)||null;
 if(selectedRow){
  const saved=surveys.find((s:any)=>s.campaign_id===selected.id&&s.installation_id===selectedRow.installation_id);
  const completed=selectedRow.status==="Completada"||Boolean(saved);
  return <section className="panel surveySinglePage">
   <div className="surveySingleHead"><div><button type="button" className="simpleBack" onClick={onBack}>← Instalaciones</button><h2>{selectedRow.installations?.name||"Instalación"}</h2><p>{selectedRow.installations?.contracts?.clients?.legal_name||"Cliente"} · {selectedRow.installations?.contracts?.name||"Contrato"} · {parseCampaignLabel(selected.label).name}</p></div><span className={"statePill "+(completed?"st-done":"st-available")}>{completed?"Completada":"Pendiente"}</span></div>
   {!completed&&<div className="surveyRemoteAccess"><h3>Acceso remoto a esta instalación</h3><p>Genera o envía el acceso solamente si el conteo lo realizará una persona en terreno.</p><SurveyLinkControl campaignId={selected.id} installationId={selectedRow.installation_id} installationName={selectedRow.installations?.name||"Instalación"}/></div>}
   <SurveyInstallationForm campaignId={selected.id} row={selectedRow} savedSurvey={saved} onClose={onBack} onNextNeed={onNextNeed}/>
  </section>;
 }
 const regions=[...new Set(installations.map((x:any)=>x.installations?.region).filter(Boolean))].sort() as string[];
 const visible=region?installations.filter((x:any)=>x.installations?.region===region):installations;
 return <section className="panel surveyCampaignSelector">
  <div className="catalogIntro"><div><button type="button" className="simpleBack" onClick={()=>onOpen("")}>← Campañas</button><h2>{parseCampaignLabel(selected.label).name}</h2><p>Selecciona una instalación. El conteo se abrirá en una pantalla independiente.</p></div></div>
  <div className="surveyCampaignFilters"><label>Región<select value={region} onChange={e=>setRegion(e.target.value)}><option value="">Todas</option>{regions.map(x=><option key={x}>{x}</option>)}</select></label></div>
  <div className="surveyInstallationCompactList">{visible.map((item:any)=>{const saved=surveys.find((s:any)=>s.campaign_id===selected.id&&s.installation_id===item.installation_id),completed=item.status==="Completada"||Boolean(saved);return <div className="surveyInstallationCompactRow" key={item.installation_id}><span><b>{item.installations?.name||"Instalación"}</b><small>{item.installations?.contracts?.clients?.legal_name||"Cliente"} · {item.installations?.contracts?.name||"Contrato"}</small></span><span><small>{[item.installations?.commune,item.installations?.city,item.installations?.region].filter(Boolean).join(" · ")}</small></span><span className={"statePill "+(completed?"st-done":"st-available")}>{completed?"Completada":"Pendiente"}</span><button type="button" onClick={()=>onOpen(selected.id,item.installation_id)}>{completed?"Ver / editar →":"Abrir levantamiento →"}</button></div>})}{!visible.length&&<Empty/>}</div>
 </section>;
}
function SurveyInstallationForm({campaignId,row,savedSurvey,onClose,onNextNeed}:{campaignId:string;row:any;savedSurvey?:any;onClose:()=>void;onNextNeed:()=>void}){
 const raw=row.installations?.contracts?.contract_materials||[];
 const materials=useMemo(()=>{const m=new Map<string,any>();for(const item of raw){if(item.installation_id&&item.installation_id!==row.installation_id)continue;const current=m.get(item.material_id);if(!current||item.installation_id===row.installation_id)m.set(item.material_id,item)}return[...m.values()].filter((x:any)=>x.authorized)},[raw,row.installation_id]);
 const initial=useMemo(()=>{const v:Record<string,number>={};for(const l of savedSurvey?.survey_lines||[])v[l.material_id]=Number(l.physical_remainder||0);return v},[savedSurvey]);
 const [remainders,setRemainders]=useState<Record<string,number>>(initial),[justification,setJustification]=useState(""),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[saved,setSaved]=useState(false);
 const correction=Boolean(savedSurvey),lines=materials.map((x:any)=>({material_id:x.material_id,physical_remainder:Number(remainders[x.material_id]||0)}));
 const submit=async(fd:FormData)=>{setSaving(true);setMessage("");try{const r=await saveSurveyWithTrace(fd);setMessage(r.corrected?"Conteo corregido. Carencia y consolidado actualizados.":"Levantamiento confirmado y enviado al consolidado.");setSaved(true);window.scrollTo({top:0,behavior:"smooth"})}catch(e:any){setMessage(e?.message||"No se pudo guardar")}finally{setSaving(false)}};
 if(saved)return <div className="surveySavedNext"><span><small>Levantamiento guardado</small><b>{message}</b></span><button type="button" onClick={onClose}>Volver a instalaciones</button><button type="button" onClick={onNextNeed}>Ver necesidades →</button></div>;
 return <div className="surveyEditor surveyEditorStandalone"><div className="surveyEditorTitle"><h3>{correction?"Editar conteo":"Registrar conteo"}</h3><p>Ingresa únicamente el remanente físico existente en esta instalación.</p></div>{materials.length?<form action={submit}><input type="hidden" name="campaign_id" value={campaignId}/><input type="hidden" name="installation_id" value={row.installation_id}/><input type="hidden" name="lines" value={JSON.stringify(lines)}/><div className="surveyMaterialList">{materials.map((x:any)=>{const rem=Number(remainders[x.material_id]||0);return <article key={x.material_id}><span><b>{x.materials?.name||"Material"}</b><small>{x.materials?.presentation||x.materials?.unit||""}</small></span><label>Remanente físico<input type="number" min="0" step="any" value={rem} onChange={e=>setRemainders(c=>({...c,[x.material_id]:Number(e.target.value)}))}/></label></article>})}</div>{correction&&<label className="surveyCorrectionReason"><b>Justificación de la corrección</b><textarea name="justification" required value={justification} onChange={e=>setJustification(e.target.value)} rows={3}/></label>}{message&&<p className="note"><b>{message}</b></p>}<div className="surveyEditorActions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancelar</button><button disabled={saving}>{saving?"Guardando…":correction?"Guardar corrección":"Confirmar levantamiento"}</button></div></form>:<Empty/>}</div>;
}
function parseCampaignLabel(label:string){try{const v=JSON.parse(label);return typeof v?.name==="string"?v:{name:label}}catch{return{name:label}}}
