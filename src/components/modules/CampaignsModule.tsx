"use client";
import {useMemo,useState} from "react";
import {closeCampaign,createCampaign} from "@/app/actions";
import type {ClientInstallationGroup} from "@/components/modules/ClientInstallationsModule";

type CampaignInstallation={id:string;status:string;justification?:string|null;installations?:{name?:string|null}|null};
type CampaignRow={id:string;label:string;status:string;created_at:string;contracts?:{name?:string|null;clients?:{legal_name?:string|null}|null}|null;campaign_installations?:CampaignInstallation[]};

export default function CampaignsModule({campaigns,clients}:{campaigns:CampaignRow[];clients:ClientInstallationGroup[]}){
 const [showNew,setShowNew]=useState(false);
 const contracts=useMemo(()=>clients.flatMap(client=>(client.contracts||[]).map(contract=>({id:contract.id,label:`${client.legal_name} · ${contract.name}`,installations:contract.installations?.length||0}))).filter(contract=>contract.installations>0),[clients]);
 return <section className="panel campaignModule"><div className="catalogIntro"><div><h2>Universo cerrado de levantamientos</h2><p>Cada campaña incorpora automáticamente todas las instalaciones activas del contrato.</p></div><button type="button" onClick={()=>setShowNew(value=>!value)}>+ Nueva campaña</button></div>
 {showNew&&<form action={createCampaign} className="adminForm campaignForm"><h3>Crear campaña</h3><label>Contrato<select name="contract_id" required defaultValue=""><option value="" disabled>Seleccionar cliente y contrato</option>{contracts.map(contract=><option value={contract.id} key={contract.id}>{contract.label} · {contract.installations} instalaciones</option>)}</select></label><label>Período / nombre<input name="label" required placeholder="Ej.: Levantamiento septiembre 2026"/></label><button>Crear campaña y universo</button></form>}
 <div className="campaignList">{campaigns.length?campaigns.map(c=>{const universe=c.campaign_installations||[];const total=universe.length;const completed=universe.filter(item=>item.status==="Completada").length;const pending=total-completed;const unjustified=universe.filter(item=>item.status!=="Completada"&&!item.justification?.trim()).length;return <article key={c.id} className="campaignCard"><div className="campaignCardHead"><span><b>{c.label}</b><small>{c.contracts?.clients?.legal_name||"Cliente"} · {c.contracts?.name||"Contrato"}</small></span><em>{c.status}</em></div><div className="campaignMetrics"><span><b>{total}</b><small>Esperadas</small></span><span><b>{completed}</b><small>Completadas</small></span><span className={pending?"pending":"complete"}><b>{pending}</b><small>Pendientes</small></span></div>{c.status==="Abierta"&&<form action={closeCampaign} className="campaignClose"><input type="hidden" name="campaign_id" value={c.id}/><button disabled={unjustified>0}>Cerrar campaña</button><small>{unjustified>0?`${unjustified} pendientes sin justificar impiden el cierre`:"Universo completo o pendientes formalmente justificadas"}</small></form>}</article>}):<div className="empty"><b>Sin campañas</b><span>Crea la primera campaña seleccionando un contrato activo.</span></div>}</div>
 </section>;
}
