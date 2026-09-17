"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

export async function registerInventoryCount(formData:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia","Admin","Operaciones","Bodega"].includes(profile.role))throw new Error("No autorizado para ajustar inventario");
 const materialId=String(formData.get("material_id")||"");const physical=Number(formData.get("physical_qty"));const reason=String(formData.get("reason")||"").trim();
 if(!materialId||!Number.isFinite(physical)||physical<0)throw new Error("Conteo físico inválido");if(reason.length<5)throw new Error("Indica el motivo del ajuste");
 const {data:rows,error}=await supabase.from("inventory_movements").select("signed_quantity").eq("material_id",materialId);if(error)throw new Error(error.message);
 const system=(rows||[]).reduce((a,r)=>a+Number(r.signed_quantity||0),0);const difference=physical-system;if(Math.abs(difference)<0.000001)return{ok:true,system,physical,difference:0};
 const {data:movement,error:insertError}=await supabase.from("inventory_movements").insert({material_id:materialId,movement_type:"adjustment",quantity:Math.abs(difference),signed_quantity:difference,created_by:user.id,observation:`Conteo físico. ${reason}. Stock sistema: ${system}; conteo: ${physical}`}).select("id").single();if(insertError)throw new Error(insertError.message);
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Inventario",action:"Ajuste por conteo físico",entity_table:"inventory_movements",entity_id:movement?.id,new_data:{material_id:materialId,stock_sistema:system,conteo_fisico:physical,diferencia:difference},observation:reason});
 revalidatePath("/");return{ok:true,system,physical,difference};
}
