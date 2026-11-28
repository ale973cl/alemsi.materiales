import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {buildBudgetCurve,monthRange,pasteExcelCurve} from "@/lib/ac-economic-engine";
const roles=["Admin Total","Gerencia","Admin"];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function context(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return {db,ok:false};
 const {data:profile}=await db.from("user_profiles").select("role,active").eq("id",user.id).single();
 return {db,ok:Boolean(profile?.active&&roles.includes(profile.role)),user};
}
export async function GET(req:NextRequest){
 const c=await context();if(!c.ok)return NextResponse.json({error:"Sin permisos"},{status:403});
 const id=req.nextUrl.searchParams.get("contrato")||"";
 if(!uuid.test(id))return NextResponse.json({error:"Contrato no válido"},{status:400});
 const [contract,months,templates]=await Promise.all([
  c.db.from("contracts").select("id,name,control_economico_activo,frecuencia_ciclo_meses,dias_anticipacion_alerta").eq("id",id).maybeSingle(),
  c.db.from("ac_contrato_presupuesto_mensual").select("mes,techo_neto_clp").eq("contrato_id",id).order("mes"),
  c.db.from("ac_plantillas_curva_presupuesto").select("id,nombre,tipo,montos_neto_clp").order("creado_en",{ascending:false}).limit(40)
 ]);
 if(contract.error||months.error||templates.error)return NextResponse.json({available:false,reason:"Motor económico aún no habilitado en la base"},{status:200});
 if(!contract.data)return NextResponse.json({error:"Contrato no encontrado"},{status:404});
 return NextResponse.json({available:true,contract:contract.data,months:months.data||[],templates:templates.data||[]});
}
export async function POST(req:NextRequest){
 const c=await context();if(!c.ok)return NextResponse.json({error:"Sin permisos"},{status:403});
 let body:any;try{body=await req.json()}catch{return NextResponse.json({error:"Solicitud inválida"},{status:400})}
 const id=String(body.contractId||"");
 if(!uuid.test(id))return NextResponse.json({error:"Contrato no válido"},{status:400});
 const {data:found,error:foundError}=await c.db.from("contracts").select("id").eq("id",id).single();
 if(foundError||!found)return NextResponse.json({error:"Contrato no disponible"},{status:404});
 try{
  if(body.action==="disable"){
   const {error}=await c.db.from("contracts").update({control_economico_activo:false}).eq("id",id);
   if(error)throw error;
   return NextResponse.json({ok:true,message:"Control económico desactivado. El histórico permanece."});
  }
  if(body.action==="template"){
   const vals:number[]=Array.isArray(body.amounts)?body.amounts.map((v:unknown)=>Number(v)):[];
   if(!vals.length||vals.length>120||vals.some(v=>!Number.isFinite(v)||v<0))throw Error("Curva inválida");
   const {error}=await c.db.from("ac_plantillas_curva_presupuesto").insert({nombre:String(body.name||"").trim(),tipo:String(body.type||"variable"),montos_neto_clp:vals,creado_por:c.user?.id});
   if(error)throw error;return NextResponse.json({ok:true,message:"Plantilla de curva guardada"});
  }
  if(body.action!=="save")throw Error("Acción no válida");
  const from=String(body.start||""),to=String(body.end||"");
  let amounts:number[]=Array.isArray(body.values)?body.values.map(Number):[];
  const mode=body.mode==="fija"?"fija":body.mode==="remanente"?"remanente":"variable";
  if(body.templateId){
   if(!uuid.test(String(body.templateId)))throw Error("Plantilla inválida");
   const {data:t,error}=await c.db.from("ac_plantillas_curva_presupuesto").select("montos_neto_clp").eq("id",body.templateId).single();
   if(error||!t)throw Error("Plantilla no disponible");
   amounts=(t.montos_neto_clp as unknown[]).map(Number);
  }else if(typeof body.paste==="string"&&body.paste.trim())amounts=pasteExcelCurve(body.paste);
  const curve=buildBudgetCurve({mode,start:from,end:to,
   fixedCLP:body.fixedCLP===undefined?undefined:Number(body.fixedCLP),
   values:amounts.length?amounts:undefined,
   todayMonth:String(body.todayMonth||new Date().toISOString().slice(0,7))});
  if(!curve.length)throw Error("No hay meses nuevos que guardar");
  if(curve.length!==monthRange(from,to).length&&mode!=="remanente")throw Error("Curva incompleta");
  const cycle=body.frequency===null?null:Number(body.frequency),ahead=body.advance===null?null:Number(body.advance);
  if(cycle!==null&&(!Number.isInteger(cycle)||cycle<1||cycle>24))throw Error("Frecuencia de ciclo inválida");
  if(ahead!==null&&(!Number.isInteger(ahead)||ahead<0||ahead>365))throw Error("Anticipación de alertas inválida");
  const {error:saveError}=await c.db.from("ac_contrato_presupuesto_mensual").upsert(
   curve.map(m=>({contrato_id:id,mes:m.month,techo_neto_clp:m.netCLP,actualizado_en:new Date().toISOString()})),
   {onConflict:"contrato_id,mes"});
  if(saveError)throw saveError;
  const {error:activeError}=await c.db.from("contracts").update({control_economico_activo:true,frecuencia_ciclo_meses:cycle,dias_anticipacion_alerta:ahead}).eq("id",id);
  if(activeError)throw activeError;
  return NextResponse.json({ok:true,message:"Presupuesto mensual guardado y control activado",months:curve.length});
 }catch(e:any){return NextResponse.json({error:e?.message||"No se pudo guardar"},{status:400})}
}
