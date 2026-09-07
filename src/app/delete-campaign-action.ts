"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteCampaignSafe(formData:FormData) {
  const campaignId=String(formData.get("campaign_id")||"");
  const confirmation=String(formData.get("confirmation")||"");
  if(!campaignId||confirmation!=="ELIMINAR") throw new Error("Confirmación de eliminación inválida");

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("Sesión no válida");

  const {data:profile,error:profileError}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
  if(profileError||!profile?.active||!["Admin Total","Gerencia"].includes(profile.role)) throw new Error("No autorizado para eliminar campañas");

  const {error}=await supabase.rpc("delete_campaign_admin",{p_campaign_id:campaignId,p_confirmation:confirmation});
  if(error) throw new Error(error.message);
  revalidatePath("/");
}
