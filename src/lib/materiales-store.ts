"use client";
import {useEffect,useState} from "react";
import type {Campaign,ConsolidatedLine,MaterialState,Role} from "./materiales-domain";

const KEY="alemsi-materiales-v05";
export const uid=(p:string)=>`${p}-${crypto.randomUUID()}`;
export const isoDate=()=>new Date().toISOString().slice(0,10);
export const now=()=>new Date().toISOString();
export const clp=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(n)||0);

export function initialState(profileId:string):MaterialState{
 return {role:"Admin",selectedProfileId:profileId,contractMaterials:[],campaigns:[],surveys:[],supplyRuns:[],purchaseOrders:[],receipts:[],localPurchases:[],dispatches:[],kits:[],limits:{},suppliers:["Proveedor por definir"]};
}
export function useMaterialStore(defaultProfileId:string){
 const [state,setState]=useState<MaterialState>(()=>initialState(defaultProfileId)); const [ready,setReady]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw)setState({...initialState(defaultProfileId),...JSON.parse(raw)})}catch{} setReady(true)},[defaultProfileId]);
 useEffect(()=>{if(ready)localStorage.setItem(KEY,JSON.stringify(state))},[state,ready]);
 return {state,setState,patch:(p:Partial<MaterialState>)=>setState(s=>({...s,...p})),reset:()=>{localStorage.removeItem(KEY);location.reload()}};
}
export function activeCampaign(state:MaterialState,profileId:string){
 return state.campaigns.find(c=>c.profileId===profileId&&c.status==="Abierta")||state.campaigns.filter(c=>c.profileId===profileId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
}
export function campaignSurveys(state:MaterialState,campaign?:Campaign){return campaign?state.surveys.filter(s=>s.campaignId===campaign.id):[]}
export function consolidatedFor(state:MaterialState,campaign?:Campaign):ConsolidatedLine[]{
 if(!campaign)return []; const map=new Map<string,ConsolidatedLine>();
 state.surveys.filter(s=>s.campaignId===campaign.id&&s.status==="Confirmado"&&!s.remoteCandidate).forEach(s=>s.lines.filter(l=>l.shortage>0).forEach(l=>{
  const c=map.get(l.productId)||{productId:l.productId,productName:l.productName,qty:0,net:0,origins:[]};
  c.qty+=l.shortage;c.net+=l.lineNet;c.origins.push({installationId:s.installationId,installationName:s.installationName,qty:l.shortage});map.set(l.productId,c)
 }));
 return [...map.values()];
}
export function visibleModules(role:Role){
 const all=["inicio","clientes","maestro","levantamiento","cotejo","consolidado","kits","oc","ingreso","guias","pendientes","historico","gestion"];
 if(role==="Supervisora")return ["inicio","levantamiento","cotejo","pendientes","historico"];
 if(role==="Finanzas")return ["inicio","oc","ingreso","pendientes","historico"];
 if(role==="Bodega")return ["inicio","ingreso","guias","pendientes","historico"];
 if(role==="Gerencia")return ["inicio","clientes","maestro","cotejo","consolidado","kits","oc","pendientes","historico"];
 return all;
}
