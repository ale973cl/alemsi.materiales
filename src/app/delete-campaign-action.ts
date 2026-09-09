"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteCampaignSafe(formData:FormData) {
  try {
    const campaignId=String(formData.get("campaign_id")||"");
    const confirmation=String(formData.get("confirmation")||"");
    if(!campaignId||confirmation!=="ELIMINAR") return {ok:false,error:"Confirmación de eliminación inválida"};

    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return {ok:false,error:"Sesión no válida"};

    const {data:profile,error:profileError}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
    if(profileError||!profile?.active||!["Admin Total","Gerencia"].includes(profile.role)) return {ok:false,error:"No autorizado para eliminar campañas"};

    const {error}=await supabase.rpc("delete_campaign_admin",{p_campaign_id:campaignId,p_confirmation:confirmation});
    if(error) return {ok:false,error:error.message||"No fue posible eliminar la campaña"};
    revalidatePath("/");
    return {ok:true,message:"Campaña eliminada correctamente"};
  } catch (error:any) {
    return {ok:false,error:error?.message||"No fue posible eliminar la campaña"};
  }
}
