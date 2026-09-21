"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

const allowedStatuses=new Set(["INACTIVO","DEMO","ACTIVO"]);
export async function setAdditionalServiceStatus(formData:FormData){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión requerida.");
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||profile.role!=="Admin Total")throw new Error("Solo Admin Total puede cambiar el estado de los servicios.");
 const serviceCode=String(formData.get("service_code")||"").trim();
 const status=String(formData.get("status")||"").trim();
 if(!["rendiciones","flota","cotizaciones"].includes(serviceCode)||!allowedStatuses.has(status))throw new Error("Configuración inválida.");
 const {error}=await supabase.from("additional_services").update({status,configured_by:user.id,updated_at:new Date().toISOString()}).eq("service_code",serviceCode);
 if(error)throw new Error(error.message);
 revalidatePath("/");
 revalidatePath("/rendiciones");
}

export async function setAdditionalServiceUserAccess(formData:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)throw new Error("Sesión requerida.");
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single(); if(!profile?.active||profile.role!=="Admin Total")throw new Error("Solo Admin Total puede asignar servicios adicionales.");
 const serviceCode=String(formData.get("service_code")||"").trim(),targetUserId=String(formData.get("user_id")||"").trim(),active=String(formData.get("active")||"false")==="true";
 if(!["rendiciones","flota","cotizaciones"].includes(serviceCode)||!targetUserId)throw new Error("Asignación inválida.");
 const {error}=await supabase.from("additional_service_user_access").upsert({service_code:serviceCode,user_id:targetUserId,active,granted_by:user.id,updated_at:new Date().toISOString()},{onConflict:"service_code,user_id"}); if(error)throw new Error(error.message); revalidatePath("/"); revalidatePath("/rendiciones");
}
