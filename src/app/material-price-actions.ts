"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

export async function updateMaterialNetPrice(formData:FormData){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) return {ok:false,error:"Sesión no válida"};
 const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia","Finanzas","Admin"].includes(profile.role)) return {ok:false,error:"No autorizado para ajustar precios"};
 const materialId=String(formData.get("material_id")||"");
 const newPrice=Number(formData.get("new_price"));
 const reason=String(formData.get("reason")||"").trim();
 if(!materialId||!Number.isFinite(newPrice)||newPrice<0) return {ok:false,error:"Ingresa un valor neto válido"};
 if(!reason) return {ok:false,error:"Debes indicar el motivo del ajuste"};
 const {data:old,error:oldError}=await supabase.from("materials").select("id,name,current_net_price").eq("id",materialId).single();
 if(oldError||!old) return {ok:false,error:"Material no encontrado"};
 const {error}=await supabase.from("materials").update({current_net_price:newPrice,price_source_note:`Ajuste manual: ${reason}`,updated_at:new Date().toISOString()}).eq("id",materialId);
 if(error) return {ok:false,error:error.message||"No fue posible actualizar el precio"};
 const {error:auditError}=await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Maestro de materiales",action:"Ajuste manual de precio",entity_table:"materials",entity_id:materialId,old_data:{current_net_price:Number(old.current_net_price||0)},new_data:{current_net_price:newPrice,origin:"Ajuste manual",reason},observation:reason});
 if(auditError) return {ok:false,error:"El precio se actualizó, pero no fue posible registrar la auditoría. Revisa con Administración."};
 revalidatePath("/");
 return {ok:true,material_id:materialId,new_price:newPrice,message:"Precio neto actualizado correctamente"};
}
