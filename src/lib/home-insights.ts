export type GroupKey="client"|"campaign"|"period";
export type DeliveryGroup={id:string;label:string;total:number;delivered:number;inProgress:number;incident:number};
export type MaterialBudget={id:string;client:string;contract:string;netBudget:number|null};
export type HomeInsights={
 deliveries: {total:number;delivered:number;inProgress:number;incident:number;truncated:boolean;groups:Record<GroupKey,DeliveryGroup[]>}|null;
 budgets:MaterialBudget[]|null;
};
type DispatchInput={id:string;campaign_id?:string|null;status:string;created_at:string;delivered_at?:string|null;observations?:string|null;installations?:any};
type CampaignInput={id:string;label:string};
const statesDone=new Set(["Entregado conforme"]);
const statesIncident=new Set(["Entrega parcial","Entrega con observaciones","Entrega parcial regularizada","Rechazado/No entregado"]);
const obj=(v:any):any=>Array.isArray(v)?v[0]:v;
const campaignTitle=(label:string)=>{try{const v=JSON.parse(label);return String(v.name||v.deliveryPeriod||label||"Campaña sin nombre")}catch{return label||"Campaña sin nombre"}};
const groupRows=(values:Map<string,DeliveryGroup>)=>[...values.values()].sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label,"es"));
const month=(date:string)=>/^\d{4}-\d{2}/.test(date)?date.slice(0,7):"Sin fecha";
export function summarizeDeliveries(rows:DispatchInput[],campaigns:CampaignInput[],truncated=false):NonNullable<HomeInsights["deliveries"]>{
 const campaignsById=new Map(campaigns.map(c=>[c.id,campaignTitle(c.label)]));
 const groups:Record<GroupKey,Map<string,DeliveryGroup>>={client:new Map(),campaign:new Map(),period:new Map()};
 let delivered=0,inProgress=0,incident=0;
 for(const d of rows){
  if(d.status==="Anulado")continue;
  const inst=obj(d.installations),contract=obj(inst?.contracts),client=obj(contract?.clients);
  const clientId=String(client?.id||"sin-cliente"),clientName=String(client?.legal_name||"Sin cliente identificado");
  const campaignId=String(d.campaign_id||d.observations?.match(/CAMPAÑA:([0-9a-f-]{36})/i)?.[1]||"sin-campana");
  const name=campaignsById.get(campaignId)||"Sin campaña asociada";
  const date=month(d.delivered_at||d.created_at);
  const category=statesDone.has(d.status)?"delivered":statesIncident.has(d.status)?"incident":"inProgress";
  if(category==="delivered")delivered++; else if(category==="incident")incident++;else inProgress++;
  for(const [key,id,label] of [["client",clientId,clientName],["campaign",campaignId,name],["period",date,date]] as [GroupKey,string,string][]){
   const values=groups[key];const row=values.get(id)||{id,label,total:0,delivered:0,inProgress:0,incident:0};
   row.total++;row[category]++;values.set(id,row);
  }
 }
 return {total:delivered+inProgress+incident,delivered,inProgress,incident,truncated,groups:{client:groupRows(groups.client),campaign:groupRows(groups.campaign),period:groupRows(groups.period)}};
}
export function sumMaterialBudgets(rows:MaterialBudget[]):{total:number;configured:number;missing:number}{
 return rows.reduce((acc,row)=>{
  if(row.netBudget===null){acc.missing++;return acc}
  acc.configured++;acc.total+=row.netBudget;return acc
 },{total:0,configured:0,missing:0});
}
