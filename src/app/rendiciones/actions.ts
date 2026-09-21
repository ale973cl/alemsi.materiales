"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enqueueModuleEmail } from "@/lib/email-queue";

const money=(v:FormDataEntryValue|null)=>Math.max(0,Number(v||0));
const text=(v:FormDataEntryValue|null)=>String(v||"").trim();

async function context(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) throw new Error("Sesión requerida.");
 const {data:profile}=await supabase.from("user_profiles").select("id,full_name,email,role,active").eq("id",user.id).single();
 if(!profile?.active) throw new Error("Usuario no habilitado.");
 const {data:allowed}=await supabase.rpc("has_additional_service_access",{p_service_code:"rendiciones"});
 if(!allowed&&profile.role!=="Admin Total") throw new Error("Rendiciones no está habilitado para este usuario.");
 return {supabase,user,profile};
}

export async function createRendition(formData:FormData){
 const {supabase,user,profile}=await context();
 const payload={
  creator_user_id:user.id,person_rut:text(formData.get("person_rut")),person_name:text(formData.get("person_name"))||profile.full_name,
  person_email:text(formData.get("person_email"))||profile.email,period_start:text(formData.get("period_start")),period_end:text(formData.get("period_end")),
  company_funds:money(formData.get("company_funds")),observations:text(formData.get("observations"))||null
 };
 if(!payload.person_rut||!payload.person_name||!payload.period_start||!payload.period_end)throw new Error("Completa identificación y período.");
 const {data,error}=await supabase.from("renditions").insert(payload).select("id,folio").single();
 if(error)throw new Error(error.message);
 revalidatePath("/rendiciones");
}

export async function addRenditionExpense(formData:FormData){
 const {supabase}=await context(); const renditionId=text(formData.get("rendition_id"));
 const amount=money(formData.get("presented_amount"));
 const row={rendition_id:renditionId,expense_date:text(formData.get("expense_date")),category:text(formData.get("category")),document_type:text(formData.get("document_type")),provider_name:text(formData.get("provider_name"))||null,provider_rut:text(formData.get("provider_rut"))||null,document_number:text(formData.get("document_number"))||null,description:text(formData.get("description")),presented_amount:amount};
 if(!renditionId||!row.expense_date||!row.category||!row.document_type||!row.description)throw new Error("Completa los datos obligatorios del gasto.");
 const {error}=await supabase.from("rendition_expenses").insert(row); if(error)throw new Error(error.message);
 const {data:expenses}=await supabase.from("rendition_expenses").select("presented_amount").eq("rendition_id",renditionId);
 const total=(expenses||[]).reduce((s:any,x:any)=>s+Number(x.presented_amount||0),0);
 await supabase.from("renditions").update({total_presented:total,updated_at:new Date().toISOString()}).eq("id",renditionId);
 revalidatePath("/rendiciones");
}

export async function submitRendition(formData:FormData){
 const {supabase,profile}=await context(); const id=text(formData.get("rendition_id"));
 const {data:r}=await supabase.from("renditions").select("id,folio,status,total_presented,person_name").eq("id",id).single();
 if(!r||!["Borrador","Observada"].includes(r.status))throw new Error("La rendición no está disponible para envío.");
 const next=r.status==="Observada"?"Reenviada":"Enviada";
 const {error}=await supabase.from("renditions").update({status:next,submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
 if(error)throw new Error(error.message);
 await enqueueModuleEmail(supabase,{module:"renditions",event:"submitted",emailType:"rendition_submitted",relatedTable:"renditions",relatedId:id,subject:`Rendición ${r.folio} enviada`,summary:`${r.person_name} envió una rendición por $ ${Number(r.total_presented||0).toLocaleString("es-CL")}.`,facts:{Folio:r.folio,Responsable:r.person_name,"Total presentado":Number(r.total_presented||0)},idempotencyKey:`renditions:submitted:${id}:${next}`});
 await supabase.from("activity_log").insert({actor_id:profile.id,actor_name:profile.full_name,module:"renditions",action:"submitted",entity_table:"renditions",entity_id:id,new_data:{status:next}});
 revalidatePath("/rendiciones");
}
