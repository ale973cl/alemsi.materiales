"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function campaignContext(allowed:string[]) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!allowed.includes(profile.role)) throw new Error("No autorizado para esta operación");
  return {supabase,user,profile};
}

async function campaignAudit(supabase:any,user:any,profile:any,data:{action:string;entity_id:string;old_data?:any;new_data?:any;observation?:string}) {
  await supabase.from("activity_log").insert({
    actor_id:user.id,
    actor_name:profile.full_name||profile.email,
    module:"Campañas",
    action:data.action,
    entity_table:"campaigns",
    entity_id:data.entity_id,
    old_data:data.old_data||null,
    new_data:data.new_data||null,
    observation:data.observation||null,
  });
}

export async function justifyCampaignInstallation(formData:FormData) {
  const {supabase,user,profile}=await campaignContext(["Admin Total","Gerencia","Admin"]);
  const campaignId=String(formData.get("campaign_id")||"");
  const installationId=String(formData.get("installation_id")||"");
  const reason=String(formData.get("reason")||"").trim();
  if(!campaignId||!installationId||reason.length<4) throw new Error("Campaña, instalación y justificación son obligatorias");

  const {data:campaign,error:campaignError}=await supabase.from("campaigns").select("id,status").eq("id",campaignId).single();
  if(campaignError||!campaign) throw new Error("Campaña no encontrada");
  if(campaign.status!=="Abierta") throw new Error("Solo se pueden justificar instalaciones de campañas abiertas");

  const {data:current,error:readError}=await supabase.from("campaign_installations").select("campaign_id,installation_id,status,justification").eq("campaign_id",campaignId).eq("installation_id",installationId).single();
  if(readError||!current) throw new Error("La instalación no pertenece a la campaña");
  if(current.status==="Completada") throw new Error("La instalación ya tiene un levantamiento completado");

  const {error}=await supabase.from("campaign_installations").update({
    status:"Justificada",
    justification:reason,
    supervisor_id:user.id,
  }).eq("campaign_id",campaignId).eq("installation_id",installationId);
  if(error) throw error;

  await campaignAudit(supabase,user,profile,{action:"Justificar instalación sin levantamiento",entity_id:campaignId,old_data:current,new_data:{installation_id:installationId,status:"Justificada",justification:reason}});
  revalidatePath("/");
}

export async function forceCloseCampaign(formData:FormData) {
  const {supabase,user,profile}=await campaignContext(["Admin Total","Gerencia"]);
  const campaignId=String(formData.get("campaign_id")||"");
  const reason=String(formData.get("reason")||"").trim();
  if(!campaignId||reason.length<5) throw new Error("Debes indicar el motivo del cierre forzado");

  const {data:campaign,error:campaignError}=await supabase.from("campaigns").select("id,label,status").eq("id",campaignId).single();
  if(campaignError||!campaign) throw new Error("Campaña no encontrada");
  if(campaign.status!=="Abierta") throw new Error("La campaña ya está cerrada");

  const {data:pending,error:pendingError}=await supabase.from("campaign_installations").select("campaign_id,installation_id,status,justification").eq("campaign_id",campaignId).neq("status","Completada");
  if(pendingError) throw pendingError;

  for(const item of pending||[]) {
    const justification=String(item.justification||"").trim()||`Cierre forzado: ${reason}`;
    const {error}=await supabase.from("campaign_installations").update({status:"Justificada",justification,supervisor_id:user.id}).eq("campaign_id",campaignId).eq("installation_id",item.installation_id);
    if(error) throw error;
  }

  const closedAt=new Date().toISOString();
  const {error:closeError}=await supabase.from("campaigns").update({status:"Cerrada",closed_at:closedAt}).eq("id",campaignId);
  if(closeError) throw closeError;

  await campaignAudit(supabase,user,profile,{action:"Cierre forzado",entity_id:campaignId,old_data:{status:campaign.status,pending:pending?.length||0},new_data:{status:"Cerrada",closed_at:closedAt},observation:reason});
  revalidatePath("/");
}

export async function deleteCampaign(formData:FormData) {
  const {supabase,user,profile}=await campaignContext(["Admin Total","Gerencia"]);
  const campaignId=String(formData.get("campaign_id")||"");
  const confirmation=String(formData.get("confirmation")||"");
  if(!campaignId||confirmation!=="ELIMINAR") throw new Error("Confirmación de eliminación inválida");

  const {data:campaign,error:campaignError}=await supabase.from("campaigns").select("id,label,status,created_at").eq("id",campaignId).single();
  if(campaignError||!campaign) throw new Error("Campaña no encontrada");

  const {data:surveys,error:surveyError}=await supabase.from("surveys").select("id,status,installation_id").eq("campaign_id",campaignId);
  if(surveyError) throw surveyError;
  const surveyIds=(surveys||[]).map((item:any)=>item.id);

  const [{count:supplyCount,error:supplyError},{count:dispatchCount,error:dispatchError}]=await Promise.all([
    supabase.from("supply_runs").select("id",{count:"exact",head:true}).eq("campaign_id",campaignId),
    supabase.from("dispatches").select("id",{count:"exact",head:true}).eq("campaign_id",campaignId),
  ]);
  if(supplyError) throw supplyError;
  if(dispatchError) throw dispatchError;
  if((supplyCount||0)>0||(dispatchCount||0)>0) throw new Error("La campaña ya tiene abastecimiento o despachos relacionados. Debes cerrarla, no eliminarla");

  if(surveyIds.length) {
    const {data:surveyLines,error:lineReadError}=await supabase.from("survey_lines").select("id").in("survey_id",surveyIds);
    if(lineReadError) throw lineReadError;
    const lineIds=(surveyLines||[]).map((item:any)=>item.id);
    if(lineIds.length) {
      const {count:allocationCount,error:allocationError}=await supabase.from("supply_allocations").select("id",{count:"exact",head:true}).in("survey_line_id",lineIds);
      if(allocationError) throw allocationError;
      if((allocationCount||0)>0) throw new Error("La campaña ya alimentó abastecimiento. Debes cerrarla, no eliminarla");
      const {error:deleteLinesError}=await supabase.from("survey_lines").delete().in("survey_id",surveyIds);
      if(deleteLinesError) throw deleteLinesError;
    }
    const {count:localPurchaseCount,error:localPurchaseError}=await supabase.from("local_purchase_requests").select("id",{count:"exact",head:true}).in("survey_id",surveyIds);
    if(localPurchaseError) throw localPurchaseError;
    if((localPurchaseCount||0)>0) throw new Error("La campaña tiene compras locales relacionadas. Debes cerrarla, no eliminarla");
    const {error:deleteSurveysError}=await supabase.from("surveys").delete().in("id",surveyIds);
    if(deleteSurveysError) throw deleteSurveysError;
  }

  const {error:deleteUniverseError}=await supabase.from("campaign_installations").delete().eq("campaign_id",campaignId);
  if(deleteUniverseError) throw deleteUniverseError;

  await campaignAudit(supabase,user,profile,{action:"Eliminar campaña",entity_id:campaignId,old_data:{campaign,surveys:surveys||[]},observation:"Eliminación administrativa antes de abastecimiento/despacho"});
  const {error:deleteCampaignError}=await supabase.from("campaigns").delete().eq("id",campaignId);
  if(deleteCampaignError) throw deleteCampaignError;

  revalidatePath("/");
}
