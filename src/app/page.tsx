"use client";
import {useEffect,useState} from "react";
import master from "@/data/master.json";
import operations from "@/data/operations.v02.json";
import type {ClientProfile,Product} from "@/lib/materiales-domain";
import {useMaterialStore,visibleModules} from "@/lib/materiales-store";
import AppShell from "@/components/AppShell";
import HomeModule from "@/components/modules/HomeModule";
import ClientsModule from "@/components/modules/ClientsModule";
import MasterModule from "@/components/modules/MasterModule";
import SurveyModule from "@/components/modules/SurveyModule";
import CompareModule from "@/components/modules/CompareModule";
import ConsolidadoModule from "@/components/modules/ConsolidadoModule";
import KitsModule from "@/components/modules/KitsModule";
import OCModule from "@/components/modules/OCModule";
import ReceiptModule from "@/components/modules/ReceiptModule";
import DispatchModule from "@/components/modules/DispatchModule";
import PendingModule from "@/components/modules/PendingModule";
import HistoryModule from "@/components/modules/HistoryModule";
import ManagementModule from "@/components/modules/ManagementModule";
import BackupModule from "@/components/modules/BackupModule";

const profiles=((operations as any).profiles||[]) as ClientProfile[];
const products:Product[]=(((master as any).products||[]) as any[]).map((p,i)=>({id:String(p.id||`p-${i+1}`),name:String(p.name||p.product||p.descripcion||`Producto ${i+1}`),price:Number(p.price??p.netPrice??p.precio??p.unitPrice??0)||0,presentation:String(p.presentation||p.presentacion||""),code:String(p.code||p.codigo||""),active:true}));

export default function Page(){
 const {state,setState,patch}=useMaterialStore(profiles[0]?.id||"");const [tab,setTab]=useState("inicio");
 useEffect(()=>{if(!visibleModules(state.role).includes(tab))setTab("inicio")},[state.role,tab]);
 const profile=profiles.find(p=>p.id===state.selectedProfileId)||profiles[0];
 if(!profile)return <div className="fatal">No hay perfiles cargados.</div>;
 return <AppShell tab={tab} setTab={setTab} state={state} patch={patch} profiles={profiles}>
  {tab==="inicio"&&<HomeModule state={state} profile={profile}/>}
  {tab==="clientes"&&<ClientsModule profiles={profiles}/>}
  {tab==="maestro"&&<MasterModule state={state} setState={setState} profile={profile} products={products}/>}
  {tab==="levantamiento"&&<SurveyModule state={state} setState={setState} profile={profile} products={products}/>}
  {tab==="cotejo"&&<CompareModule state={state} profile={profile}/>}
  {tab==="consolidado"&&<ConsolidadoModule state={state} setState={setState} profile={profile}/>}
  {tab==="kits"&&<KitsModule state={state} setState={setState} profile={profile}/>}
  {tab==="oc"&&<OCModule state={state}/>}
  {tab==="ingreso"&&<ReceiptModule state={state} setState={setState} profile={profile}/>}
  {tab==="guias"&&<DispatchModule state={state} setState={setState} profile={profile}/>}
  {tab==="pendientes"&&<PendingModule state={state} profile={profile}/>}
  {tab==="historico"&&<HistoryModule state={state} profile={profile}/>}
  {tab==="gestion"&&<ManagementModule state={state} setState={setState} profiles={profiles} products={products}/>}
  {tab==="respaldos"&&state.role==="Admin Total"&&<BackupModule/>}
 </AppShell>;
}
