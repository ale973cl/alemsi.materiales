"use server";
import {CAPABILITIES,rolesFor} from "@/lib/authorization";

import {headers} from "next/headers";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {enqueueModuleEmail} from "@/lib/email-queue";

const PRE_OUTPUT=["Borrador","Pendiente","En preparación","Listo para despacho"];
const ROUTE_FINAL_DISPATCH_STATUSES=["Entregado conforme","Entrega con observaciones","Entrega parcial","Rechazado/No entregado","Anulado"];
async function closeFinishedRoutes(supabase:any,dispatchId:string){const {data:links}=await supabase.from("delivery_route_dispatches").select("route_id").eq("dispatch_id",dispatchId);for(const link of links||[]){const {data:route}=await supabase.from("delivery_routes").select("id,status,delivery_route_dispatches(dispatches(status))").eq("id",(link as any).route_id).single();if(!route||!["En tránsito","Parcialmente entregada"].includes(String((route as any).status)))continue;const routeLinks=((route as any).delivery_route_dispatches||[]) as any[];const statuses=routeLinks.map(x=>String(Array.isArray(x.dispatches)?x.dispatches[0]?.status:x.dispatches?.status||""));if(statuses.length&&statuses.every(status=>ROUTE_FINAL_DISPATCH_STATUSES.includes(status))){await supabase.from("delivery_routes").update({status:"Completada",updated_at:new Date().toISOString()}).eq("id",(route as any).id);}}
}

async function ctx(roles:readonly string[]){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!roles.includes(profile.role))throw new Error("No autorizado para esta operación");
  return{supabase,user,profile};
}

function campaignInfo(label:string){try{return JSON.parse(label||"{}")}catch{return{name:label||"Campaña"}}}
function fillTemplate(template:string,values:Record<string,string>){return Object.entries(values).reduce((text,[key,value])=>text.replaceAll(`{${key}}`,value||"—"),template)}
async function origin(){const h=await headers();const host=h.get("x-forwarded-host")||h.get("host");const protocol=h.get("x-forwarded-proto")||"https";return host?`${protocol}://${host}`:process.env.NEXT_PUBLIC_APP_URL||""}

export async function createCampaignDispatch(input:{surveyId:string}){
  const {supabase}=await ctx(rolesFor(CAPABILITIES.DISPATCH_MANAGE));
  const {data:survey,error}=await supabase.from("surveys").select("id,campaign_id,installation_id,status,campaigns(id,label,status),installations(id,name,address,commune,city,region,contracts(id,name,clients(id,legal_name))),survey_lines(material_id,shortage_qty)").eq("id",input.surveyId).single();
  if(error||!survey)throw new Error("Levantamiento no encontrado");
  if(survey.status!=="Confirmada")throw new Error("El levantamiento aún no está confirmado");
  const campaign:any=Array.isArray((survey as any).campaigns)?(survey as any).campaigns[0]:(survey as any).campaigns;
  const installation:any=Array.isArray((survey as any).installations)?(survey as any).installations[0]:(survey as any).installations;
  const contract:any=Array.isArray(installation?.contracts)?installation.contracts[0]:installation?.contracts;
  const client:any=Array.isArray(contract?.clients)?contract.clients[0]:contract?.clients;
  const lines=(survey as any).survey_lines||[];
  const materialIds=[...new Set(lines.filter((l:any)=>Number(l.shortage_qty)>0).map((l:any)=>String(l.material_id)))];
  if(!materialIds.length)throw new Error("Esta instalación no tiene materiales pendientes de entrega");

  const [{data:movements},{data:dispatches}]=await Promise.all([
    supabase.from("inventory_movements").select("material_id,signed_quantity").in("material_id",materialIds),
    supabase.from("dispatches").select("id,installation_id,status,observations,dispatch_lines(material_id,required_qty)").neq("status","Anulado"),
  ]);
  const stock=new Map<string,number>();for(const m of movements||[])stock.set(String((m as any).material_id),(stock.get(String((m as any).material_id))||0)+Number((m as any).signed_quantity||0));
  const committed=new Map<string,number>();
  for(const d of dispatches||[]){if(!PRE_OUTPUT.includes((d as any).status))continue;for(const l of (d as any).dispatch_lines||[]){const id=String(l.material_id);committed.set(id,(committed.get(id)||0)+Number(l.required_qty||0));}}
  const already=new Map<string,number>();const marker=`CAMPAÑA:${survey.campaign_id}`;
  for(const d of dispatches||[]){if(String((d as any).installation_id)!==String(survey.installation_id)||!String((d as any).observations||"").includes(marker))continue;for(const l of (d as any).dispatch_lines||[]){const id=String(l.material_id);already.set(id,(already.get(id)||0)+Number(l.required_qty||0));}}

  const alloc:{material_id:string;quantity:number}[]=[];let stillPending=0;
  for(const l of lines){const id=String((l as any).material_id);const required=Math.max(Number((l as any).shortage_qty||0)-(already.get(id)||0),0);if(required<=0)continue;const available=Math.max((stock.get(id)||0)-(committed.get(id)||0),0);const quantity=Math.min(required,available);if(quantity>0){alloc.push({material_id:id,quantity});committed.set(id,(committed.get(id)||0)+quantity);}stillPending+=Math.max(required-quantity,0);}
  if(!alloc.length)throw new Error("No hay stock disponible para generar esta guía. La instalación queda pendiente de abastecimiento.");

  const info=campaignInfo(campaign?.label||"");
  const template=String(info.deliveryTemplate||`${info.name||"Entrega"} · {INSTALACION}`);
  const text=fillTemplate(template,{INSTALACION:installation?.name||"Instalación",PERIODO:info.deliveryPeriod||info.name||"",CLIENTE:client?.legal_name||"",CONTRATO:contract?.name||""});
  const observations=`CAMPAÑA:${survey.campaign_id} · ${text}`;
  const {data:dispatchId,error:dispatchError}=await supabase.rpc("create_dispatch_v1",{p_installation_id:survey.installation_id,p_lines:alloc,p_observations:observations});
  if(dispatchError)throw new Error(dispatchError.message);
  revalidatePath("/");
  return{ok:true,id:String(dispatchId),allocated:alloc.length,partial:stillPending>0,pendingUnits:stillPending};
}

export async function registerDeliveryWithEmail(input:{dispatchId:string;recipientName:string;recipientRut:string;recipientRole?:string;recipientEmail:string;observations?:string;signature?:string;lines:{line_id:string;delivered_qty:number}[]}){
  const {supabase,user,profile}=await ctx(rolesFor(CAPABILITIES.DELIVERY_REGISTER));
  const email=String(input.recipientEmail||"").trim().toLowerCase();
  if(!email||!email.includes("@"))throw new Error("Ingresa el correo de la persona que recibe");

  // El cierre físico es la operación principal. Si esto falla, no se continúa.
  const {data:status,error}=await supabase.rpc("register_dispatch_delivery_v1",{p_dispatch_id:input.dispatchId,p_lines:input.lines,p_recipient_name:input.recipientName,p_recipient_rut:input.recipientRut,p_recipient_role:input.recipientRole||null,p_observations:input.observations||null,p_signature:input.signature||null});
  if(error)throw new Error(error.message);

  // Desde aquí, PDF/correo son respaldo secundario: nunca deben derribar una entrega ya registrada.
  let emailStatus="Pendiente";
  let emailError:string|null=null;
  try{
    const {error:updateError}=await supabase.from("dispatches").update({recipient_email:email,email_status:"Pendiente"}).eq("id",input.dispatchId);
    if(updateError)throw updateError;

    const {data:d,error:dispatchLoadError}=await supabase.from("dispatches").select("id,internal_number,installations(name,contracts(name,clients(legal_name)))").eq("id",input.dispatchId).single();
    if(dispatchLoadError)throw dispatchLoadError;
    const installation:any=Array.isArray((d as any)?.installations)?(d as any).installations[0]:(d as any)?.installations;
    const contract:any=Array.isArray(installation?.contracts)?installation.contracts[0]:installation?.contracts;
    const client:any=Array.isArray(contract?.clients)?contract.clients[0]:contract?.clients;
    const base=await origin();
    const queued=await enqueueModuleEmail(supabase,{module:"dispatch",event:"signed_delivery_copy",emailType:"signed_delivery_copy",relatedTable:"dispatches",relatedId:input.dispatchId,subject:`Comprobante de entrega ${d?.internal_number||""} · ALEMSI`,summary:"Se registró la entrega de materiales. Este correo corresponde al respaldo informado por la persona que recibió.",to:[email],facts:{Cliente:client?.legal_name||"—",Contrato:contract?.name||"—",Instalación:installation?.name||"—",Receptor:input.recipientName,Estado:String(status||"Entregado")},actionUrl:base?`${base}/despachos/${input.dispatchId}/guia`:null,idempotencyKey:`signed-delivery:${input.dispatchId}:${String(status)}`});
    emailStatus=String((queued as any)?.status||(queued as any)?.delivery?.status||"Pendiente");
  }catch(mailError){
    emailError=mailError instanceof Error?mailError.message:String(mailError);
    console.error("DISPATCH_DELIVERY_EMAIL_ERROR",{dispatchId:input.dispatchId,error:emailError});
    await supabase.from("dispatches").update({recipient_email:email,email_status:"Pendiente"}).eq("id",input.dispatchId);
  }

  await closeFinishedRoutes(supabase,input.dispatchId);
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Despachos",action:"Registró entrega y correo de receptor",entity_table:"dispatches",entity_id:input.dispatchId,new_data:{recipient_email:email,email_status:emailStatus,email_error:emailError}});
  revalidatePath("/");
  return{ok:true,status:String(status),emailStatus,emailPending:emailStatus!=="Enviado"};
}

export async function createComplementaryDispatch(input:{parentDispatchId:string}){
  const {supabase}=await ctx(rolesFor(CAPABILITIES.DISPATCH_MANAGE));
  const {data,error}=await supabase.rpc("create_complementary_dispatch_v1",{p_parent_dispatch_id:input.parentDispatchId});
  if(error)throw new Error(error.message);
  revalidatePath("/");
  return{ok:true,id:String(data)};
}
