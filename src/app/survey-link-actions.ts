"use server";
import {createHash,randomBytes} from "crypto";
import {createClient} from "@/lib/supabase/server";
import {enqueueModuleEmail} from "@/lib/email-queue";

async function managerContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin","Operaciones","Supervisora"].includes(profile.role))throw new Error("No autorizado para generar links de conteo");
  return{supabase,user,profile};
}

const PRODUCTION_APP_ORIGIN="https://alemsi-materiales.vercel.app";
function tokenHash(token:string){return createHash("sha256").update(token).digest("hex")}

export async function createSurveyAccessLink(input:{campaign_id:string;installation_id:string;mode:"link"|"email";email?:string|null;valid_hours?:number}){
  const {supabase,user,profile}=await managerContext();
  const campaignId=String(input.campaign_id||"");const installationId=String(input.installation_id||"");
  if(!campaignId||!installationId)throw new Error("Campaña e instalación son obligatorias");
  if(profile.role==="Supervisora"){
    const {data:ownAccess}=await supabase.from("user_installation_access").select("installation_id").eq("user_id",user.id).eq("installation_id",installationId).eq("active",true).eq("can_survey",true).maybeSingle();
    if(!ownAccess)throw new Error("No autorizado para generar acceso para esta instalación");
  }
  const {data:membership,error}=await supabase.from("campaign_installations").select("campaign_id,installation_id,status,installations(name,region,contracts(name,clients(legal_name)))").eq("campaign_id",campaignId).eq("installation_id",installationId).single();
  if(error||!membership)throw new Error("La instalación no pertenece a la campaña");
  if(membership.status==="Completada")throw new Error("El conteo ya está completado. Para corregirlo usa el flujo interno con justificación.");
  const {data:campaign}=await supabase.from("campaigns").select("id,label,status").eq("id",campaignId).single();
  if(!campaign||campaign.status!=="Abierta")throw new Error("La campaña no está abierta");
  let target=String(input.email||"").trim().toLowerCase();
  if(input.mode==="email"&&!target){
    const {data:access}=await supabase.from("user_installation_access").select("user_profiles(email,active,role)").eq("installation_id",installationId).eq("active",true).eq("can_survey",true);
    target=String((access||[]).map((x:any)=>x.user_profiles).flat().find((p:any)=>p?.active&&p?.role==="Supervisora"&&p?.email)?.email||"").trim().toLowerCase();
  }
  if(input.mode==="email"&&!target)throw new Error("No hay correo de supervisora asignado. Ingresa un correo antes de enviar.");
  const token=randomBytes(12).toString("base64url");const hash=tokenHash(token);const hours=Math.min(168,Math.max(1,Number(input.valid_hours||72)));const expires=new Date(Date.now()+hours*3600000).toISOString();
  const {error:updateError}=await supabase.from("campaign_installations").update({survey_token_hash:hash,survey_token_expires_at:expires,survey_token_email:target||null,survey_token_created_at:new Date().toISOString(),survey_token_created_by:user.id,survey_token_used_at:null}).eq("campaign_id",campaignId).eq("installation_id",installationId);
  if(updateError)throw updateError;
  const link=`${PRODUCTION_APP_ORIGIN}/conteo/${token}`;
  const inst:any=Array.isArray((membership as any).installations)?(membership as any).installations[0]:(membership as any).installations;const contract:any=Array.isArray(inst?.contracts)?inst.contracts[0]:inst?.contracts;const client:any=Array.isArray(contract?.clients)?contract.clients[0]:contract?.clients;
  let emailStatus="link_only";let queueId:string|null=null;
  if(input.mode==="email"){
    try{
      const senderName=profile.full_name||profile.email||"Usuario ALEMSI";const senderRole=profile.role||"Usuario";
      const queued:any=await enqueueModuleEmail(supabase,{module:"campaigns",event:"survey_token_link",emailType:"survey_token_link",relatedTable:"campaign_installations",relatedId:installationId,subject:`Solicitud de conteo de materiales · ${inst?.name||"Instalación"}`,summary:`${senderName}, ${senderRole}, mediante ALEMSI Materiales solicita realizar el conteo de materiales correspondiente a ${inst?.name||"la instalación"}.`,to:[target],facts:{Cliente:client?.legal_name||"—",Contrato:contract?.name||"—",Instalación:inst?.name||"—",Región:inst?.region||"—",Vigencia:`${hours} horas`,Solicitante:senderName,Rol:senderRole},actionUrl:link,idempotencyKey:`survey-token:${campaignId}:${installationId}:${hash.slice(0,16)}`});
      queueId=queued?.id||null;const status=String(queued?.status||queued?.delivery?.status||"");emailStatus=status==="Enviado"?"sent":status==="Bloqueado"?"blocked":status==="Pendiente"||status==="Procesando"?"pending":queued?.queued?"pending":"failed";
    }catch{emailStatus="failed";}
  }
  try{await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Levantamientos",action:input.mode==="email"?"Enviar link token de conteo":"Generar link token de conteo",entity_table:"campaign_installations",entity_id:installationId,new_data:{campaign_id:campaignId,expires_at:expires,email:target||null,email_status:emailStatus,email_queue_id:queueId}});}catch{}
  return{ok:true,link,expires_at:expires,email:target||null,email_status:emailStatus,queue_id:queueId};
}
