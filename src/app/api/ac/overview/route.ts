import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {calculatePayable} from "@/lib/ac-invoice-credit";
import {santiagoDate} from "@/lib/central-calendar";
import {monthPlus} from "@/lib/ac-economic-engine";
const number=(v:unknown)=>Number(v||0);
const first=(v:any):any=>Array.isArray(v)?v[0]:v;
export async function GET(){
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sesión no válida"},{status:401});
 const {data:profile}=await db.from("user_profiles").select("active,role").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia","Admin","Finanzas"].includes(profile.role))
  return NextResponse.json({error:"Sin permisos para información económica"},{status:403});
 const queries=await Promise.all([
  db.from("contracts").select("id,client_id,name,start_date,end_date,control_economico_activo,frecuencia_ciclo_meses,dias_anticipacion_alerta,clients(legal_name)").eq("active",true).limit(1001),
  db.from("ac_v_resumen_mensual").select("contrato_id,mes,techo_neto_clp,guias_neto,retornos_neto,gastado_neto,saldo_neto").limit(1001),
  db.from("ac_guia_imputacion_mensual").select("guia_id,contrato_id,mes,importe_neto_clp,clase,dispatches(guide_number,status,created_at)").limit(1001),
  db.from("ac_campana_periodo").select("campana_id,contrato_id,mes_inicio,mes_fin").limit(1001),
  db.from("ac_v_facturas_vencimiento").select("factura_id,supplier_id,document_folio,document_type,document_total,condicion_pago,dias_credito,fecha_recepcion_sii,fecha_vencimiento,fecha_limite_reclamo,pagado_acreditado_clp").limit(1001)
 ]);
 const missing=queries.some(q=>q.error&&/does not exist|schema cache|column .* does not exist/i.test(q.error.message));
 if(missing)return NextResponse.json({available:false,reason:"Motor económico pendiente de habilitación en la base de pruebas",contracts:[],invoices:[]});
 const errors=queries.map((q,i)=>q.error?"Consulta "+(i+1)+": "+q.error.message:null).filter(Boolean);
 if(errors.length)return NextResponse.json({available:false,reason:"No se pudo cargar el control económico",errors},{status:503});
 if(queries.some(q=>(q.data||[]).length>1000))return NextResponse.json({available:false,reason:"Registros superiores a 1.000; informe incompleto"},{status:503});
 const [contractRows,months,allocations,periods,credits]:any[][]=queries.map(q=>(q.data||[]) as any[]);
 const today=santiagoDate(),currentMonth=today.slice(0,7);
 const detailByContract=new Map<string,any[]>();
 for(const g of allocations){const id=String(g.contrato_id);const entry=detailByContract.get(id)||[];entry.push({
  id:g.guia_id,guide:first(g.dispatches)?.guide_number||"Guía sin número",month:g.mes,net:number(g.importe_neto_clp),kind:g.clase,status:first(g.dispatches)?.status||"Sin estado"
 });detailByContract.set(id,entry)}
 let upcoming=0;
 const contracts=contractRows.map(c=>{
  const period=periods.find(p=>p.contrato_id===c.id&&p.mes_inicio<=currentMonth&&p.mes_fin>=currentMonth);
  const from=period?.mes_inicio||currentMonth,to=period?.mes_fin||currentMonth;
  const monthRows=months.filter(m=>m.contrato_id===c.id&&m.mes>=from&&m.mes<=to);
  const expectedMonthCount=(Number(to.slice(0,4))-Number(from.slice(0,4)))*12+Number(to.slice(5,7))-Number(from.slice(5,7))+1;
  const valid=Boolean(c.control_economico_activo)&&monthRows.length===expectedMonthCount&&expectedMonthCount>0;
  const budget=valid?monthRows.reduce((sum,m)=>sum+number(m.techo_neto_clp),0):null;
  const spent=valid?monthRows.reduce((sum,m)=>sum+number(m.gastado_neto),0):null;
  const percent=budget!==null&&budget>0&&spent!==null?spent/budget*100:null;
  const status=!valid?"sin_control":percent===null?"sin_base":percent>100?"exceso":percent>80?"alerta":"optimo";
  let nextCycle:string|null=null;
  const step=Number(c.frecuencia_ciclo_meses||0);
  if(c.start_date&&Number.isInteger(step)&&step>=1&&step<=24){
   let candidate=String(c.start_date).slice(0,7);
   for(let i=0;i<360&&candidate<currentMonth;i++)candidate=monthPlus(candidate,step);
   if(candidate>=currentMonth)nextCycle=candidate+"-01";
   if(nextCycle&&Math.round((Date.parse(nextCycle+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000)<=Number(c.dias_anticipacion_alerta??15)&&nextCycle>=today)upcoming++;
  }
  const cycleUpcoming=nextCycle!==null&&nextCycle>=today&&Math.round((Date.parse(nextCycle+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000)<=Number(c.dias_anticipacion_alerta??15);
  return {id:c.id,clientId:c.client_id,clientName:first(c.clients)?.legal_name||"Cliente",name:c.name,upcoming:cycleUpcoming,
   active:Boolean(c.control_economico_activo),cycle:period?from+" a "+to:"Mes actual",nextCycle,
   budget,spent,percent,remaining:budget!==null&&spent!==null?budget-spent:null,
   status,curve:monthRows.map(m=>({month:m.mes,budget:number(m.techo_neto_clp),spent:number(m.gastado_neto),returns:number(m.retornos_neto)})),
   guides:detailByContract.get(c.id)||[],campaignCost:null};
 });
 const invoices=credits.map(r=>{
  const p=calculatePayable({paymentTerms:r.condicion_pago,creditDays:r.dias_credito,
   siiReceiptDate:r.fecha_recepcion_sii,today,totalCLP:number(r.document_total),accreditedCLP:number(r.pagado_acreditado_clp)});
  return {id:r.factura_id,folio:r.document_folio,documentType:r.document_type,supplierId:r.supplier_id,...p};
 });
 return NextResponse.json({available:true,month:currentMonth,contracts,invoices,kpi:{
  optimal:contracts.filter(c=>c.status==="optimo").length,alert:contracts.filter(c=>c.status==="alerta").length,
  excess:contracts.filter(c=>c.status==="exceso").length,upcoming,
  withoutControl:contracts.filter(c=>c.status==="sin_control").length,
  invoicesDue:invoices.filter(i=>i.state==="Por Vencer").length,invoicesLate:invoices.filter(i=>i.state==="Vencida").length
 }});
}
