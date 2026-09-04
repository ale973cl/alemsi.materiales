"use client";
import type {ClientProfile,MaterialState} from "@/lib/materiales-domain";
import {activeCampaign,campaignSurveys} from "@/lib/materiales-store";
import {Kpi} from "../Common";
export default function PendingModule({state,profile}:{state:MaterialState;profile:ClientProfile}){const c=activeCampaign(state,profile.id),expected=c?.expectedInstallationIds||[],done=new Set(campaignSurveys(state,c).map(s=>s.installationId));return <><h1>Pendientes</h1><div className="grid g4"><Kpi label="Sin levantar" value={expected.filter(x=>!done.has(x)).length}/><Kpi label="Compra local" value={state.localPurchases.filter(x=>x.profileId===profile.id&&x.status!=="Cerrada").length}/><Kpi label="OC abiertas" value={state.purchaseOrders.filter(x=>x.status!=="Recibida").length}/><Kpi label="Guías abiertas" value={state.dispatches.filter(x=>x.profileId===profile.id&&x.status!=="Cerrada").length}/></div></>}
