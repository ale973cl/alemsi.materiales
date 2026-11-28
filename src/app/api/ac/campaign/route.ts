import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {campaignBaseBudget,monthRange,valueCampaign,type MaterialNeed} from "@/lib/ac-economic-engine";
const isId=(s:string)=>/^[0-9a-f-]{36}$/i.test(s);
const first=(x:any):any=>Array.isArray(x)?x[0]:x;
async function dbContext(write=false){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return{db,ok:false};const {data:p}=await db.from("user_profiles").select("role,active").eq("id",user.id).maybeSingle();return{db,ok:Boolean(p?.active&&["Admin Total","Gerencia","Admin",...(write?[]:["Finanzas"])].includes(p.role))};}
export async function GET(req:NextRequest){
 const {db,ok}=await dbContext();if(!ok)return NextResponse.json({error:"Sin permisos"},{status:403});
 const id=req.nextUrl.searchParams.get("campana")||"";if(!isId(id))return NextResponse.json({error:"Campaña inválida"},{status:400});
 const responses=await Promise.all([
  db.from("campaign_installations").select("installation_id,installations(contract_id,contracts(name,control_economico_activo))").eq("campaign_id",id).limit(1001),
  db.from("surveys").select("installation_id,survey_lines(material_id,authorized_qty,physical_remainder,shortage_qty)").eq("campaign_id",id).eq("status","Confirmada").limit(1001),
  db.from("materials").select("id,current_net_price").limit(1001),
  db.from("inventory_movements").select("material_id,signed_quantity").limit(1001),
  db.from("receipt_lines").select("material_id,actual_unit_net,receipts(document_date,inventory_posted)").limit(1001),
  db.from("ac_campana_periodo").select("contrato_id,mes_inicio,mes_fin").eq("campana_id",id).limit(1001),
  db.from("ac_contrato_presupuesto_mensual").select("contrato_id,mes,techo_neto_clp").limit(1001)
 ]);
 if(responses.some(r=>r.error&&/does not exist|schema cache|column .* does not exist/i.test(r.error.message)))return NextResponse.json({available:false,reason:"Sin control económico habilitado"});
 if(responses.some(r=>r.error||(r.data||[]).length>1000))return NextResponse.json({error:"Consulta incompleta, no se muestran importes"},{status:503});
 const [links,surveys,materials,movements,invoiceLines,periods,budgets]:any[][]=responses.map(r=>(r.data||[]) as any[]);
 const contracts=new Map<string,{name:string;active:boolean}>();
 const owners=new Map<string,string>();
 for(const l of links){const i=first(l.installations),c=first(i?.contracts);if(!i?.contract_id)continue;owners.set(l.installation_id,i.contract_id);contracts.set(i.contract_id,{name:c?.name||"Contrato",active:Boolean(c?.control_economico_activo)})}
 const stock=new Map<string,number>();for(const x of movements)stock.set(x.material_id,(stock.get(x.material_id)||0)+Number(x.signed_quantity||0));
 const prices=new Map<string,number|null>(materials.map(x=>[x.id,x.current_net_price===null?null:Number(x.current_net_price)]));
 const last=new Map<string,{price:number;date:string}>();
 for(const l of invoiceLines){const r=first(l.receipts);if(!r?.inventory_posted)continue;const date=String(r.document_date||""),old=last.get(l.material_id);if(l.actual_unit_net!==null&&(!old||date>old.date))last.set(l.material_id,{price:Number(l.actual_unit_net),date})}
 const usedStockBy=new Map<string,Set<string>>();
 for(const s of surveys){const owner=owners.get(s.installation_id);if(!owner)continue;for(const l of s.survey_lines||[]){const set=usedStockBy.get(l.material_id)||new Set<string>();set.add(owner);usedStockBy.set(l.material_id,set)}}
 const groups=[...contracts.entries()].map(([contractId,c])=>{
  const perMaterial=new Map<string,{maxQty:number;physicalQty:number;consolidatedShortage:number}>();
  for(const survey of surveys.filter(s=>owners.get(s.installation_id)===contractId))for(const l of survey.survey_lines||[]){
   const v=perMaterial.get(l.material_id)||{maxQty:0,physicalQty:0,consolidatedShortage:0};
   v.maxQty+=Number(l.authorized_qty||0);v.physicalQty+=Number(l.physical_remainder||0);v.consolidatedShortage+=Number(l.shortage_qty||0);perMaterial.set(l.material_id,v)}
  const materialNeeds:MaterialNeed[]=[...perMaterial].map(([key,v])=>({...v,availableStock:Math.max(0,stock.get(key)||0),weightedCost:prices.get(key)??null,lastInvoiceUnitNet:last.get(key)?.price??null}));
  const estimated=valueCampaign(materialNeeds);
  const shared=[...perMaterial.keys()].some(key=>(usedStockBy.get(key)?.size||0)>1&&(stock.get(key)||0)>0);
  const coverage=periods.find(x=>x.contrato_id===contractId);
  const monthly=budgets.filter(x=>x.contrato_id===contractId).map(x=>({month:x.mes,netCLP:Number(x.techo_neto_clp)}));
  return {contractId,contractName:c.name,active:c.active,start:coverage?.mes_inicio||"",end:coverage?.mes_fin||"",
   base:coverage?campaignBaseBudget(monthly,coverage.mes_inicio,coverage.mes_fin):null,
   theoretical:estimated.theoretical,shortage:estimated.shortage,purchaseRequired:shared?null:estimated.purchaseRequired,
   reason:[...estimated.incomplete,shared?"Stock compartido sin distribución contractual":""].filter(Boolean).join(" · ")};
 });
 return NextResponse.json({available:true,groups});
}
export async function POST(req:NextRequest){
 const {db,ok}=await dbContext(true);if(!ok)return NextResponse.json({error:"Sin permisos"},{status:403});
 let input:any;try{input=await req.json()}catch{return NextResponse.json({error:"Solicitud inválida"},{status:400})}
 const id=String(input.campaignId||""),contractId=String(input.contractId||"");
 if(!isId(id)||!isId(contractId))return NextResponse.json({error:"Referencia inválida"},{status:400});
 try{const months=monthRange(String(input.start||""),String(input.end||""));
  const {data:links,error}=await db.from("campaign_installations").select("installations(contract_id)").eq("campaign_id",id).limit(1001);
  if(error||!links?.some(x=>first(x.installations)?.contract_id===contractId))throw Error("Contrato ajeno a la campaña");
  const {data:rows,error:budgetError}=await db.from("ac_contrato_presupuesto_mensual").select("mes").eq("contrato_id",contractId).in("mes",months);
  if(budgetError||rows?.length!==months.length)throw Error("Configura todos los meses del contrato; la operación diaria continúa disponible");
  const {error:save}=await db.from("ac_campana_periodo").upsert({campana_id:id,contrato_id:contractId,mes_inicio:months[0],mes_fin:months[months.length-1]},{onConflict:"campana_id,contrato_id"});
  if(save)throw save;return NextResponse.json({ok:true,message:"Período guardado"});
 }catch(e:any){return NextResponse.json({error:e.message||"No se pudo guardar"},{status:400})}
}
