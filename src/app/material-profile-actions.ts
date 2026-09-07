"use server";

import { createClient } from "@/lib/supabase/server";

async function allowedContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role)) throw new Error("No autorizado para configurar materiales");
  return supabase;
}

export async function loadInstallationMaterialProfile(contractId:string,installationId:string){
  const supabase=await allowedContext();
  if(!contractId||!installationId) throw new Error("Contrato e instalación son obligatorios");
  const {data:installation,error:installationError}=await supabase.from("installations").select("id,contract_id,name").eq("id",installationId).eq("contract_id",contractId).eq("active",true).single();
  if(installationError||!installation) throw new Error("Instalación no válida para este contrato");
  const {data:assignments,error:assignmentError}=await supabase.from("contract_materials").select("id,material_id,authorized,authorized_qty,net_limit,coverage_status,notes,updated_at").eq("contract_id",contractId).eq("installation_id",installationId);
  if(assignmentError) throw assignmentError;
  const {data:limits,error:limitError}=await supabase.from("contract_limits").select("id,material_id,period_type,period_value,quantity_limit,net_amount_limit,active").eq("contract_id",contractId).eq("installation_id",installationId).eq("active",true);
  if(limitError) throw limitError;
  return {installation,assignments:assignments||[],limits:limits||[]};
}

type SaveInput={contract_id:string;installation_id:string;material_id:string;assigned:boolean;authorized_qty:number;period_type?:string|null;period_value?:number|null;quantity_limit?:number|null;net_amount_limit?:number|null;coverage_status?:string|null;notes?:string|null};
export async function saveInstallationMaterialConfig(input:SaveInput){
  const supabase=await allowedContext();
  const payload={
    p_contract_id:input.contract_id,
    p_installation_id:input.installation_id,
    p_material_id:input.material_id,
    p_assigned:Boolean(input.assigned),
    p_authorized_qty:Number(input.authorized_qty||0),
    p_period_type:input.period_type||null,
    p_period_value:input.period_value??null,
    p_quantity_limit:input.quantity_limit??null,
    p_net_amount_limit:input.net_amount_limit??null,
    p_coverage_status:input.coverage_status||"included",
    p_notes:input.notes||null,
  };
  const {data,error}=await supabase.rpc("save_client_profile_material_config",payload);
  if(error) throw new Error(error.message);
  return data;
}
