"use server";

import {headers} from "next/headers";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {coveredCampaignQuantity} from "@/lib/campaign-dispatch-balance";
import {enqueueModuleEmail} from "@/lib/email-queue";

const PRE_OUTPUT=["Borrador","Pendiente","En preparación","Listo para despacho"];

async function ctx(roles:string[]){
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

export async function createCampaignDispatch(input:{surveyId:string;preparedLines?:{material_id:string;quantity:number}[];batch?:{id:string;createdAt:string;client:string;campaign:string;installations:string[];differenceNote?:string}}){
  const {supabase}=await ctx(["Admin Total","Admin","Bodega"]);
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
    supabase.from("dispatches").select("id,installation_id,status,observations,dispatch_lines(material_id,required_qty,delivered_qty)").neq("status","Anulado"),
  ]);
  const stock=new Map<string,number>();for(const m of movements||[])stock.set(String((m as any).material_id),(stock.get(String((m as any).material_id))||0)+Number((m as any).signed_quantity||0));
  const committed=new Map<string,number>();
  for(const d of dispatches||[]){if(!PRE_OUTPUT.includes((d as any).status))continue;for(const l of (d as any).dispatch_lines||[]){const id=String(l.material_id);committed.set(id,(committed.get(id)||0)+Number(l.required_qty||0));}}
  const already=new Map<string,number>();const marker=`CAMPAÑA:${survey.campaign_id}`;
  for(const d of dispatches||[]){if(String((d as any).installation_id)!==String(survey.installation_id)||!String((d as any).observations||"").includes(marker))continue;for(const l of (d as any).dispatch_lines||[]){const id=String(l.material_id);already.set(id,(already.get(id)||0)+coveredCampaignQuantity(String((d as any).status),l.required_qty,l.delivered_qty));}}

  const manual=Array.isArray(input.preparedLines);
  const chosen=new Map<string,number>();
  if(manual){
    for(const line of input.preparedLines||[]){
      const id=String(line.material_id||"");
      const qty=Number(line.quantity);
      if(!id||chosen.has(id)||!Number.isFinite(qty)||qty<0)throw new Error("Cantidades preparadas inválidas o producto repetido");
      chosen.set(id,qty);
    }
    if([...chosen.keys()].some(id=>!materialIds.includes(id)))throw new Error("La preparación contiene un producto no autorizado por el levantamiento");
  }
  const alloc:{material_id:string;quantity:number}[]=[];let stillPending=0;
  for(const l of lines){const id=String((l as any).material_id);const required=Math.max(Number((l as any).shortage_qty||0)-(already.get(id)||0),0);if(required<=0)continue;const available=Math.max((stock.get(id)||0)-(committed.get(id)||0),0);const capacity=Math.min(required,available);const quantity=manual?Number(chosen.get(id)||0):capacity;if(quantity>capacity)throw new Error("La cantidad preparada excede la necesidad o el stock disponible");if(quantity>0){alloc.push({material_id:id,quantity});committed.set(id,(committed.get(id)||0)+quantity);}stillPending+=Math.max(required-quantity,0);}
  if(!alloc.length)throw new Error("No hay stock disponible para generar esta guía. La instalación queda pendiente de abastecimiento.");

  const info=campaignInfo(campaign?.label||"");
  const template=String(info.deliveryTemplate||`${info.name||"Entrega"} · {INSTALACION}`);
  const text=fillTemplate(template,{INSTALACION:installation?.name||"Instalación",PERIODO:info.deliveryPeriod||info.name||"",CLIENTE:client?.legal_name||"",CONTRATO:contract?.name||""});
   const batch=input.batch?` · TANDA:${String(input.batch.id).slice(0,80)} · FECHA TANDA:${String(input.batch.createdAt).slice(0,32)} · CLIENTE TANDA:${String(input.batch.client).slice(0,160)} · CAMPAÑA TANDA:${String(input.batch.campaign).slice(0,160)} · INSTALACIONES TANDA:${input.batch.installations.map(x=>String(x).slice(0,80)).join(" | ").slice(0,700)}`:"";
   const differences=input.batch?.differenceNote?` · DIFERENCIA PREPARACIÓN:${String(input.batch.differenceNote).slice(0,500)}`:"";
   const observations=`CAMPAÑA:${survey.campaign_id} · ${text}${manual?" · PREPARACIÓN FÍSICA CONFIRMADA":""}${batch}${differences}`;
  const {data:dispatchId,error:dispatchError}=await supabase.rpc("create_dispatch_v1",{p_installation_id:survey.installation_id,p_lines:alloc,p_observations:observations});
  if(dispatchError)throw new Error(dispatchError.message);
  revalidatePath("/");
  return{ok:true,id:String(dispatchId),allocated:alloc.length,partial:stillPending>0,pendingUnits:stillPending};
}

export async function registerDeliveryWithEmail(input:{dispatchId:string;recipientName:string;recipientRut:string;recipientRole?:string;recipientEmail:string;observations?:string;signature?:string;lines:{line_id:string;delivered_qty:number}[]}){
  const {supabase,user,profile}=await ctx(["Admin Total","Admin","Bodega","Supervisora"]);
  const email=String(input.recipientEmail||"").trim().toLowerCase();
  if(!email||!email.includes("@"))throw new Error("Ingresa el correo de la persona que recibe");

  // El cierre físico es la operación principal. Si esto falla, no se continúa.
  const {data:status,error}=await supabase.rpc("register_dispatch_delivery_v1",{p_dispatch_id:input.dispatchId,p_lines:input.lines,p_recipient_name:input.recipientName,p_recipient_rut:input.recipientRut,p_recipient_role:input.recipientRole||null,p_observations:input.observations||null,p_signature:input.signature||null});
  if(error)throw new Error(error.message);

  // Una diferencia entre lo cargado y lo entregado no vuelve a stock disponible hasta resolver físicamente su destino.
  if(String(status)==="Entrega parcial"){
    const {data:pendingLines,error:pendingError}=await supabase.from("dispatch_lines").select("id,material_id,pending_qty").eq("dispatch_id",input.dispatchId).gt("pending_qty",0);
    if(pendingError)throw new Error("La entrega fue registrada, pero no se pudo inmovilizar el saldo pendiente: "+pendingError.message);
    for(const line of pendingLines||[]){
      const {data:holds,error:holdError}=await supabase.from("inventory_movements").select("id").eq("dispatch_line_id",line.id).eq("movement_type","adjustment").ilike("observation","Saldo físico pendiente de validación%").limit(1);
      if(holdError)throw holdError;
      if(!(holds||[]).length){
        const q=Number(line.pending_qty||0);
        const {error:moveError}=await supabase.from("inventory_movements").insert({material_id:line.material_id,dispatch_line_id:line.id,movement_type:"adjustment",quantity:q,signed_quantity:-q,created_by:user.id,observation:"Saldo físico pendiente de validación de entrega "+input.dispatchId});
        if(moveError)throw new Error("La entrega fue registrada, pero no se pudo bloquear el saldo pendiente: "+moveError.message);
      }
    }
  }

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

  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Despachos",action:"Registró entrega y correo de receptor",entity_table:"dispatches",entity_id:input.dispatchId,new_data:{recipient_email:email,email_status:emailStatus,email_error:emailError}});
  revalidatePath("/");
  return{ok:true,status:String(status),emailStatus,emailPending:emailStatus!=="Enviado"};
}

export async function createComplementaryDispatch(input:{parentDispatchId:string}){
  const {supabase}=await ctx(["Admin Total","Admin","Bodega"]);
  const {data,error}=await supabase.rpc("create_complementary_dispatch_v1",{p_parent_dispatch_id:input.parentDispatchId});
  if(error)throw new Error(error.message);
  revalidatePath("/");
  return{ok:true,id:String(data)};
}


export async function regularizeDispatchPending(input:{dispatchId:string;resolution:"Retorno a bodega"|"Merma"|"Pérdida"|"Reasignación";reason:string;targetInstallationId?:string}){
 const {supabase,user,profile}=await ctx(["Admin Total","Admin","Bodega"]);
 const dispatchId=String(input.dispatchId||"").trim(),reason=String(input.reason||"").trim();
 if(!dispatchId||!reason)throw new Error("Selecciona la guía e indica el motivo de la regularización");
 const {data:d,error:de}=await supabase.from("dispatches").select("id,status,internal_number,guide_number,dispatch_lines(id,material_id,required_qty,delivered_qty,pending_qty)").eq("id",dispatchId).single();
 if(de||!d)throw new Error("Guía no encontrada");
 if(d.status!=="Entrega parcial")throw new Error("Solo se regularizan guías con entrega parcial");
 const lines=((d as any).dispatch_lines||[]).filter((l:any)=>Number(l.pending_qty||0)>0);
 if(!lines.length)throw new Error("La guía no tiene saldos pendientes");
 const {data:existing,error:ee}=await supabase.from("activity_log").select("id").eq("module","Despachos").eq("action","Regularizó saldo no entregado").eq("entity_table","dispatches").eq("entity_id",dispatchId).limit(1);
 if(ee)throw ee;if((existing||[]).length)throw new Error("Esta diferencia ya fue regularizada");
 const resolution=input.resolution;
 let newDispatchId:string|null=null;
 const positiveMovements=lines.map((l:any)=>({material_id:l.material_id,dispatch_line_id:l.id,movement_type:"adjustment",quantity:Number(l.pending_qty),signed_quantity:Number(l.pending_qty),created_by:user.id,observation:(resolution==="Reasignación"?"Liberación para reasignar":"Retorno físico a bodega")+" desde "+String(d.internal_number||d.guide_number||dispatchId)}));
 if(resolution==="Retorno a bodega"){
   const {error}=await supabase.from("inventory_movements").insert(positiveMovements);if(error)throw error;
 }else if(resolution==="Reasignación"){
   const target=String(input.targetInstallationId||"").trim();if(!target)throw new Error("Selecciona la instalación de destino");
   const {error:returnError}=await supabase.from("inventory_movements").insert(positiveMovements);if(returnError)throw returnError;
   const payload=lines.map((l:any)=>({material_id:l.material_id,quantity:Number(l.pending_qty)}));
   const {data:newId,error:createError}=await supabase.rpc("create_dispatch_v1",{p_installation_id:target,p_lines:payload,p_observations:"Reasignación de saldo desde "+String(d.internal_number||d.guide_number||dispatchId)+" · "+reason});
   if(createError){
     await supabase.from("inventory_movements").insert(lines.map((l:any)=>({material_id:l.material_id,dispatch_line_id:l.id,movement_type:"adjustment",quantity:Number(l.pending_qty),signed_quantity:-Number(l.pending_qty),created_by:user.id,observation:"Reversa de reasignación fallida "+dispatchId})));
     throw new Error(createError.message);
   }
   newDispatchId=String(newId);
   const {error:transitionError}=await supabase.rpc("transition_dispatch_v1",{p_dispatch_id:newDispatchId,p_status:"En preparación",p_reason:null});
   if(transitionError)throw new Error("La nueva guía fue creada, pero requiere continuar su preparación: "+transitionError.message);
 }else if(!["Merma","Pérdida"].includes(resolution))throw new Error("Resolución no válida");

 const {error:lineUpdate}=await supabase.from("dispatch_lines").update({pending_qty:0}).eq("dispatch_id",dispatchId).gt("pending_qty",0);
 if(lineUpdate)throw lineUpdate;
 const {error:dispatchUpdate}=await supabase.from("dispatches").update({status:"Entrega parcial regularizada",updated_at:new Date().toISOString(),observations:String((d as any).observations||"")}).eq("id",dispatchId);
 if(dispatchUpdate)throw dispatchUpdate;
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Despachos",action:"Regularizó saldo no entregado",entity_table:"dispatches",entity_id:dispatchId,new_data:{resolution,reason,new_dispatch_id:newDispatchId,lines:lines.map((l:any)=>({line_id:l.id,material_id:l.material_id,qty:Number(l.pending_qty)}))},observation:reason});
 revalidatePath("/");
 return{ok:true,resolution,newDispatchId};
}
