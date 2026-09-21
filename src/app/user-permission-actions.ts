"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {CAPABILITIES,type Capability} from "@/lib/authorization";

const validCapabilities=new Set<string>(Object.values(CAPABILITIES));

export async function setUserCapabilityOverride(formData:FormData){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!profile?.active||profile.role!=="Admin Total")throw new Error("Solo Admin Total puede administrar funciones y permisos");
 const userId=String(formData.get("user_id")||"");
 const capability=String(formData.get("capability")||"") as Capability;
 const mode=String(formData.get("mode")||"inherit");
 if(!userId||!validCapabilities.has(capability)||!["inherit","allow","deny"].includes(mode))throw new Error("Permiso inválido");
 if(userId===user.id)throw new Error("Tus permisos de Admin Total están protegidos y no se modifican desde esta ficha");
 const {data:existing,error:readError}=await supabase.from("user_module_permissions").select("id,can_view").eq("user_id",userId).eq("module_code",capability).maybeSingle();
 if(readError)throw readError;
 if(mode==="inherit"){
   if(existing){const {error}=await supabase.from("user_module_permissions").delete().eq("id",existing.id);if(error)throw error;}
 }else{
   const row={user_id:userId,module_code:capability,can_view:mode==="allow",can_create:false,can_edit:false,can_approve:false,can_close:false,can_send:false,can_manage:false,granted_by:user.id,reason:mode==="allow"?"Excepción individual: permitir":"Excepción individual: bloquear",updated_at:new Date().toISOString()};
   if(existing){const {error}=await supabase.from("user_module_permissions").update(row).eq("id",existing.id);if(error)throw error;}
   else{const {error}=await supabase.from("user_module_permissions").insert(row);if(error)throw error;}
 }
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Usuarios",action:"Configurar función individual",entity_table:"user_module_permissions",entity_id:existing?.id||userId,new_data:{user_id:userId,capability,mode},observation:"El rol base sigue siendo la plantilla; esta fila representa una excepción individual."});
 revalidatePath("/");
 return;
}
