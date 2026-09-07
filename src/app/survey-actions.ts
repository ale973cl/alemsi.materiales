"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function surveyContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin","Supervisora"].includes(profile.role))throw new Error("No autorizado para esta operación");
  return{supabase,user,profile};
}

export async function saveSurveyWithTrace(formData:FormData){
  const {supabase,user,profile}=await surveyContext();
  const campaignId=String(formData.get("campaign_id")||"");
  const installationId=String(formData.get("installation_id")||"");
  const justification=String(formData.get("justification")||"").trim();
  const submitted=JSON.parse(String(formData.get("lines")||"[]")) as {material_id:string;physical_remainder:number}[];

  const {data:campaign,error:campaignError}=await supabase.from("campaigns").select("id,status").eq("id",campaignId).single();
  if(campaignError||!campaign)throw new Error("Campaña no encontrada");
  if(campaign.status!=="Abierta")throw new Error("La campaña está cerrada. Debe ser reabierta por un perfil superior antes de modificar el conteo.");

  const {data:membership,error:membershipError}=await supabase.from("campaign_installations").select("campaign_id,installation_id,installations(contract_id)").eq("campaign_id",campaignId).eq("installation_id",installationId).single();
  if(membershipError||!membership)throw new Error("La instalación no pertenece al universo de la campaña");

  if(profile.role==="Supervisora"){
    const {data:access}=await supabase.from("user_installation_access").select("id").eq("user_id",user.id).eq("installation_id",installationId).eq("active",true).eq("can_survey",true).maybeSingle();
    if(!access)throw new Error("Esta instalación no está asignada a la supervisora");
  }

  const {data:existing}=await supabase.from("surveys").select("id,status,confirmed_at,shortage_net,supervisor_id,survey_lines(material_id,authorized_qty,physical_remainder,shortage_qty,unit_net_price,line_net)").eq("campaign_id",campaignId).eq("installation_id",installationId).maybeSingle();
  const isCorrection=existing?.status==="Confirmada";
  if(isCorrection&&!justification)throw new Error("Para modificar un conteo confirmado debes ingresar una justificación");

  const contractId=(membership.installations as any)?.contract_id;
  const {data:authorized,error:materialsError}=await supabase.from("contract_materials").select("material_id,installation_id,authorized_qty,materials(current_net_price)").eq("contract_id",contractId).eq("authorized",true).or(`installation_id.is.null,installation_id.eq.${installationId}`);
  if(materialsError)throw materialsError;
  const byMaterial=new Map<string,any>();
  for(const item of authorized||[]){if(!byMaterial.has(item.material_id)||item.installation_id===installationId)byMaterial.set(item.material_id,item)}
  if(!byMaterial.size)throw new Error("La instalación no tiene materiales autorizados");
  if(submitted.length!==byMaterial.size||submitted.some(line=>!byMaterial.has(line.material_id)||Number(line.physical_remainder)<0))throw new Error("El levantamiento no coincide con los materiales autorizados");

  const lines=submitted.map(line=>{const source=byMaterial.get(line.material_id);const authorizedQty=Number(source.authorized_qty||0);const remainder=Number(line.physical_remainder||0);const shortage=Math.max(authorizedQty-remainder,0);const price=Number(source.materials?.current_net_price||0);return{material_id:line.material_id,authorized_qty:authorizedQty,physical_remainder:remainder,shortage_qty:shortage,unit_net_price:price,line_net:shortage*price}});
  const shortageNet=lines.reduce((sum,line)=>sum+line.line_net,0);

  const {data:survey,error:surveyError}=await supabase.from("surveys").upsert({campaign_id:campaignId,installation_id:installationId,supervisor_id:user.id,status:"Borrador",shortage_net:shortageNet,confirmed_at:null},{onConflict:"campaign_id,installation_id"}).select("id,campaign_id,installation_id").single();
  if(surveyError||!survey)throw surveyError||new Error("No se pudo guardar el levantamiento");
  const {error:deleteError}=await supabase.from("survey_lines").delete().eq("survey_id",survey.id);if(deleteError)throw deleteError;
  const {data:savedLines,error:insertError}=await supabase.from("survey_lines").insert(lines.map(line=>({...line,survey_id:survey.id}))).select("id,survey_id");
  if(insertError||savedLines?.length!==lines.length)throw insertError||new Error("No se guardaron todas las líneas del levantamiento");

  const confirmedAt=new Date().toISOString();
  const {error:confirmError}=await supabase.from("surveys").update({status:"Confirmada",confirmed_at:confirmedAt,shortage_net:shortageNet,supervisor_id:user.id}).eq("id",survey.id);if(confirmError)throw confirmError;
  const {error:completeError}=await supabase.from("campaign_installations").update({status:"Completada",completed_at:confirmedAt,supervisor_id:user.id}).eq("campaign_id",campaignId).eq("installation_id",installationId);if(completeError)throw completeError;

  await supabase.from("activity_log").insert({
    actor_id:user.id,
    actor_name:profile.full_name||profile.email,
    module:"Levantamientos",
    action:isCorrection?"Corregir conteo confirmado":"Confirmar levantamiento",
    entity_table:"surveys",
    entity_id:survey.id,
    old_data:isCorrection?{confirmed_at:existing?.confirmed_at,shortage_net:existing?.shortage_net,lines:existing?.survey_lines}:null,
    new_data:{confirmed_at:confirmedAt,shortage_net:shortageNet,lines},
    observation:isCorrection?justification:"Levantamiento inicial confirmado"
  });

  revalidatePath("/");
  return{ok:true,corrected:isCorrection};
}
