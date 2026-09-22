"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {enqueueModuleEmail} from "@/lib/email-queue";
import {CAPABILITIES,roleCan,type Capability} from "@/lib/authorization";
import {calculateRenditionBalance} from "@/lib/renditions/financial";

const txt=(v:FormDataEntryValue|null)=>String(v??"").trim();
const amount=(v:FormDataEntryValue|null)=>Math.max(0,Number(v||0));
const editable=new Set(["Borrador","Observada"]);
const allowedFiles=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
export type RenditionExpenseResult={ok:boolean;message:string};

async function ctx(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión requerida.");
 const {data:profile}=await supabase.from("user_profiles").select("id,full_name,email,role,active").eq("id",user.id).single();
 if(!profile?.active)throw new Error("Usuario no habilitado.");
 const {data:service}=await supabase.from("additional_services").select("status").eq("service_code","rendiciones").single();
 const {data:access}=await supabase.rpc("has_additional_service_access",{p_service_code:"rendiciones"});
 if(!access&&profile.role!=="Admin Total")throw new Error("Rendiciones no está habilitado para este usuario.");
 return {supabase,user,profile,serviceStatus:service?.status??"INACTIVO"};
}
async function can(supabase:any,profile:any,capability:Capability){if(profile.role==="Admin Total")return true;const {data:override,error}=await supabase.from("user_module_permissions").select("can_view").eq("user_id",profile.id).eq("module_code",capability).maybeSingle();if(error)throw new Error("No se pudo validar el permiso de Rendiciones.");return override?Boolean(override.can_view):roleCan(profile.role,capability);}
async function requireCapability(supabase:any,profile:any,capability:Capability,message:string){if(!(await can(supabase,profile,capability)))throw new Error(message);}

async function log(supabase:any,profile:any,id:string,action:string,data:any){
 await supabase.from("activity_log").insert({actor_id:profile.id,actor_name:profile.full_name,module:"renditions",action,entity_table:"renditions",entity_id:id,new_data:data});
}
async function saveFile(supabase:any,userId:string,expenseId:string,file:File){
 if(!allowedFiles.has(file.type))throw new Error("El comprobante debe ser JPG, PNG, WEBP o PDF.");
 if(file.size>10*1024*1024)throw new Error("El comprobante no puede superar 10 MB.");
 const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
 const path=`${expenseId}/${crypto.randomUUID()}-${safe}`;
 const {error:up}=await supabase.storage.from("rendition-documents").upload(path,file,{contentType:file.type,upsert:false});
 if(up)throw new Error("No se pudo guardar el comprobante.");
 const {data:doc,error}=await supabase.from("documents").insert({entity_table:"rendition_expenses",entity_id:expenseId,document_type:"Comprobante rendición",file_name:file.name,storage_path:path,mime_type:file.type,uploaded_by:userId}).select("id").single();
 if(error){await supabase.storage.from("rendition-documents").remove([path]);throw new Error("No se pudo registrar el comprobante.");}
 return doc.id as string;
}

export async function createRendition(fd:FormData){
 const {supabase,user,profile,serviceStatus}=await ctx(); await requireCapability(supabase,profile,CAPABILITIES.RENDITION_SUBMIT,"Sin permiso para crear rendiciones.");
 const personRut=txt(fd.get("person_rut"));
 const {data:lastSettled}=personRut?await supabase.from("renditions").select("previous_balance,company_funds,total_authorized,amount_paid").eq("person_rut",personRut).eq("status","Pagada").order("paid_at",{ascending:false}).limit(1).maybeSingle():{data:null};
 const previousBalance=lastSettled?calculateRenditionBalance({previousBalance:Number(lastSettled.previous_balance||0),companyFunds:Number(lastSettled.company_funds||0),authorized:Number(lastSettled.total_authorized||0),paid:Number(lastSettled.amount_paid||0)}).closingBalance:0;
 const row={creator_user_id:user.id,person_rut:personRut,person_name:txt(fd.get("person_name"))||profile.full_name,person_email:txt(fd.get("person_email"))||profile.email,period_start:txt(fd.get("period_start")),period_end:txt(fd.get("period_end")),previous_balance:previousBalance,company_funds:amount(fd.get("company_funds")),observations:txt(fd.get("observations"))||null,service_mode:serviceStatus==="ACTIVO"?"ACTIVO":"DEMO"};
 if(!row.person_rut||!row.person_name||!row.period_start||!row.period_end)throw new Error("Completa identificación y período.");
 const {data,error}=await supabase.from("renditions").insert(row).select("id,folio").single(); if(error)throw new Error(error.message);
 await log(supabase,profile,data.id,"created",{folio:data.folio,service_mode:row.service_mode}); revalidatePath("/rendiciones"); redirect(`/rendiciones/${data.id}`);
}

export async function addRenditionExpense(_prev:RenditionExpenseResult,fd:FormData):Promise<RenditionExpenseResult>{
 let expenseId:string|null=null;let renditionId="";
 try{
  const {supabase,user,profile}=await ctx(); await requireCapability(supabase,profile,CAPABILITIES.RENDITION_SUBMIT,"Sin permiso para agregar comprobantes."); renditionId=txt(fd.get("rendition_id"));
  const {data:r}=await supabase.from("renditions").select("id,status,creator_user_id").eq("id",renditionId).single();
  if(!r||r.creator_user_id!==user.id)return {ok:false,message:"Solo quien creó la rendición puede agregar gastos."};
  if(!editable.has(r.status))return {ok:false,message:"Esta rendición ya no permite agregar gastos."};
  const row={rendition_id:renditionId,expense_date:txt(fd.get("expense_date")),category:txt(fd.get("category")),document_type:txt(fd.get("document_type")),provider_name:txt(fd.get("provider_name"))||null,provider_rut:txt(fd.get("provider_rut"))||null,document_number:txt(fd.get("document_number"))||null,description:txt(fd.get("description")),presented_amount:amount(fd.get("presented_amount")),review_status:"Pendiente"};
  if(!row.expense_date||!row.category||!row.document_type||!row.description||row.presented_amount<=0)return {ok:false,message:"Completa los datos obligatorios del gasto."};
  const {data:expense,error}=await supabase.from("rendition_expenses").insert(row).select("id").single();
  if(error)return {ok:false,message:"No se pudo registrar el gasto. Intenta nuevamente."};
  expenseId=expense.id;
  const file=fd.get("document_file");let documentId:string|null=null;
  try{
   if(file instanceof File&&file.size>0)documentId=await saveFile(supabase,user.id,expense.id,file);
   if(documentId){const {error:link}=await supabase.from("rendition_expenses").update({document_id:documentId,updated_at:new Date().toISOString()}).eq("id",expense.id);if(link)throw new Error("No se pudo vincular el comprobante al gasto.");}
  }catch(e){
   await supabase.from("rendition_expenses").delete().eq("id",expense.id);
   return {ok:false,message:e instanceof Error?e.message:"No se pudo guardar el comprobante."};
  }
  const {data:items,error:itemsError}=await supabase.from("rendition_expenses").select("presented_amount").eq("rendition_id",renditionId);
  if(itemsError)return {ok:false,message:"El gasto se guardó, pero no fue posible actualizar el total. Recarga la página."};
  const total=(items??[]).reduce((n:number,x:{presented_amount:number|null})=>n+Number(x.presented_amount||0),0);
  const {error:totalError}=await supabase.from("renditions").update({total_presented:total,updated_at:new Date().toISOString()}).eq("id",renditionId);
  if(totalError)return {ok:false,message:"El gasto se guardó, pero no fue posible actualizar el total. Recarga la página."};
  await log(supabase,profile,renditionId,"expense_added",{expense_id:expense.id,amount:row.presented_amount,document_id:documentId});
  revalidatePath("/rendiciones");
  return {ok:true,message:"Gasto guardado correctamente."};
 }catch(e){
  console.error("addRenditionExpense",e);
  return {ok:false,message:e instanceof Error?e.message:"No se pudo guardar el gasto. Intenta nuevamente."};
 }
}

export async function submitRendition(fd:FormData){
 const {supabase,user,profile}=await ctx(); await requireCapability(supabase,profile,CAPABILITIES.RENDITION_SUBMIT,"Sin permiso para enviar rendiciones."); const id=txt(fd.get("rendition_id"));
 const {data:r}=await supabase.from("renditions").select("id,folio,status,total_presented,person_name,creator_user_id").eq("id",id).single();
 if(!r||r.creator_user_id!==user.id)throw new Error("Solo quien creó la rendición puede enviarla a Finanzas.");
 if(!editable.has(r.status)||Number(r.total_presented)<=0)return;
 const {error}=await supabase.from("renditions").update({status:"Enviada",submitted_at:new Date().toISOString(),review_observation:null,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw new Error(error.message);
 await log(supabase,profile,id,"submitted",{status:"Enviada"});
 await enqueueModuleEmail(supabase,{module:"renditions",event:"submitted",emailType:"rendition_submitted",relatedTable:"renditions",relatedId:id,subject:`Rendición ${r.folio} enviada`,summary:`${r.person_name} envió una rendición por $ ${Number(r.total_presented).toLocaleString("es-CL")}.`,facts:{Folio:r.folio,Responsable:r.person_name,"Total presentado":Number(r.total_presented)},idempotencyKey:`renditions:submitted:${id}:${Date.now()}`});
 revalidatePath("/rendiciones");
}

export async function reviewRendition(fd:FormData){
 const {supabase,user,profile}=await ctx(); if(!["Gerencia","Finanzas"].includes(profile.role))throw new Error("Solo Gerencia y Finanzas pueden revisar rendiciones."); await requireCapability(supabase,profile,CAPABILITIES.RENDITION_REVIEW,"Sin permiso para revisar.");
 const id=txt(fd.get("rendition_id")),decision=txt(fd.get("decision")),observation=txt(fd.get("observation"));
 const {data:r}=await supabase.from("renditions").select("id,status,folio,person_email,total_presented,creator_user_id").eq("id",id).single();if(!r||r.status!=="Enviada")throw new Error("La rendición no está pendiente de revisión.");if(r.creator_user_id===user.id)throw new Error("No puedes revisar tu propia rendición.");
 if(decision==="OBSERVE"){await requireCapability(supabase,profile,CAPABILITIES.RENDITION_OBSERVE,"Sin permiso para observar.");if(!observation)throw new Error("Indica qué debe corregirse.");await supabase.from("renditions").update({status:"Observada",review_observation:observation,reviewed_by:profile.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);}
 else if(decision==="REJECT"){await requireCapability(supabase,profile,CAPABILITIES.RENDITION_APPROVE,"Sin permiso para rechazar.");if(!observation)throw new Error("Indica el motivo del rechazo.");await supabase.from("renditions").update({status:"Rechazada",review_observation:observation,reviewed_by:profile.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);}
 else if(decision==="APPROVE"){await requireCapability(supabase,profile,CAPABILITIES.RENDITION_APPROVE,"Sin permiso para aprobar.");const authorized=amount(fd.get("authorized_amount"));if(authorized>Number(r.total_presented))throw new Error("El autorizado no puede superar lo presentado.");await supabase.from("renditions").update({status:"Aprobada",total_authorized:authorized,review_observation:observation||null,reviewed_by:profile.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);}
 else throw new Error("Decisión inválida.");
 await log(supabase,profile,id,"reviewed",{decision,observation}); revalidatePath("/rendiciones");
}

export async function markRenditionPaid(fd:FormData){
 const {supabase,user,profile}=await ctx(); if(profile.role!=="Finanzas")throw new Error("Solo Finanzas puede registrar pagos de rendiciones."); await requireCapability(supabase,profile,CAPABILITIES.RENDITION_PAY,"Sin permiso para registrar el pago.");
 const id=txt(fd.get("rendition_id"));const paid=amount(fd.get("amount_paid"));const observation=txt(fd.get("payment_observation"));
 const {data:r}=await supabase.from("renditions").select("status,total_authorized,previous_balance,company_funds,amount_paid,creator_user_id").eq("id",id).single();if(!r||r.status!=="Aprobada")throw new Error("La rendición debe estar aprobada.");if(r.creator_user_id===user.id)throw new Error("No puedes registrar el pago de tu propia rendición.");
 const balance=calculateRenditionBalance({previousBalance:Number(r.previous_balance||0),companyFunds:Number(r.company_funds||0),authorized:Number(r.total_authorized||0),paid:Number(r.amount_paid||0)});
 if(balance.amountToPay<=0)throw new Error("Esta rendición no tiene saldo a pagar a la persona.");
 if(paid!==balance.amountToPay)throw new Error(`El pago debe corresponder al saldo pendiente: $ ${balance.amountToPay.toLocaleString("es-CL")}.`);
 const {error}=await supabase.from("renditions").update({status:"Pagada",amount_paid:paid,payment_observation:observation||null,paid_by:profile.id,paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);if(error)throw new Error(error.message);
 await log(supabase,profile,id,"paid",{amount_paid:paid});revalidatePath("/rendiciones");
}

export async function editRenditionExpense(fd:FormData){
 const {supabase,user,profile}=await ctx();await requireCapability(supabase,profile,CAPABILITIES.RENDITION_SUBMIT,"Sin permiso para editar rendiciones.");const renditionId=txt(fd.get("rendition_id")),expenseId=txt(fd.get("expense_id"));
 const {data:r}=await supabase.from("renditions").select("status,creator_user_id").eq("id",renditionId).single();if(!r||r.creator_user_id!==user.id)throw new Error("Solo quien creó la rendición puede editar sus gastos.");if(!editable.has(r.status))throw new Error("La rendición ya no permite editar gastos.");
 const patch={expense_date:txt(fd.get("expense_date")),category:txt(fd.get("category")),document_type:txt(fd.get("document_type")),provider_name:txt(fd.get("provider_name"))||null,provider_rut:txt(fd.get("provider_rut"))||null,document_number:txt(fd.get("document_number"))||null,description:txt(fd.get("description")),presented_amount:amount(fd.get("presented_amount")),authorized_amount:null,review_status:"Pendiente",review_observation:null,reviewed_by:null,reviewed_at:null,updated_at:new Date().toISOString()};
 if(!patch.expense_date||!patch.category||!patch.document_type||!patch.description||patch.presented_amount<=0)throw new Error("Completa los datos obligatorios.");
 const {error}=await supabase.from("rendition_expenses").update(patch).eq("id",expenseId).eq("rendition_id",renditionId);if(error)throw new Error(error.message);
 const {data:items}=await supabase.from("rendition_expenses").select("presented_amount").eq("rendition_id",renditionId);const total=(items??[]).reduce((n:number,x:any)=>n+Number(x.presented_amount||0),0);
 await supabase.from("renditions").update({total_presented:total,updated_at:new Date().toISOString()}).eq("id",renditionId);await log(supabase,profile,renditionId,"expense_edited",{expense_id:expenseId});revalidatePath("/rendiciones");
}

export async function reviewExpense(fd:FormData){
 const {supabase,user,profile}=await ctx();if(!["Gerencia","Finanzas"].includes(profile.role))throw new Error("Solo Gerencia y Finanzas pueden revisar gastos.");await requireCapability(supabase,profile,CAPABILITIES.RENDITION_REVIEW,"Sin permiso para revisar.");
 const renditionId=txt(fd.get("rendition_id")),expenseId=txt(fd.get("expense_id")),decision=txt(fd.get("decision")),observation=txt(fd.get("observation"));
 const {data:r}=await supabase.from("renditions").select("status,creator_user_id").eq("id",renditionId).single();if(!r||r.status!=="Enviada")throw new Error("La rendición no está pendiente de revisión.");if(r.creator_user_id===user.id)throw new Error("No puedes revisar gastos de tu propia rendición.");
 if(decision==="OBSERVE"){
  await requireCapability(supabase,profile,CAPABILITIES.RENDITION_OBSERVE,"Sin permiso para observar.");
  if(!observation)throw new Error("Indica qué debe corregirse.");
  await supabase.from("rendition_expenses").update({review_status:"Observada",review_observation:observation,authorized_amount:null,reviewed_by:profile.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",expenseId).eq("rendition_id",renditionId);
  await supabase.from("renditions").update({status:"Observada",review_observation:"Existe al menos un gasto observado.",reviewed_by:profile.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",renditionId);
 }else{
  await requireCapability(supabase,profile,CAPABILITIES.RENDITION_APPROVE,"Sin permiso para aprobar o rechazar.");
  const {data:g}=await supabase.from("rendition_expenses").select("presented_amount").eq("id",expenseId).eq("rendition_id",renditionId).single();if(!g)throw new Error("Gasto no encontrado.");
  if(decision==="REJECT"&&!observation)throw new Error("Indica el motivo del rechazo.");if(!["APPROVE","REJECT"].includes(decision))throw new Error("Decisión inválida.");
  const authorized=decision==="APPROVE"?Math.min(amount(fd.get("authorized_amount")),Number(g.presented_amount)):0;
  await supabase.from("rendition_expenses").update({review_status:decision==="APPROVE"?"Aprobada":"Rechazada",review_observation:observation||null,authorized_amount:authorized,reviewed_by:profile.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",expenseId).eq("rendition_id",renditionId);
  const {data:items}=await supabase.from("rendition_expenses").select("review_status,authorized_amount").eq("rendition_id",renditionId);const total=(items??[]).reduce((n:number,x:any)=>n+Number(x.authorized_amount||0),0);const unresolved=(items??[]).some((x:any)=>["Pendiente","Observada"].includes(x.review_status));
  await supabase.from("renditions").update({total_authorized:total,updated_at:new Date().toISOString()}).eq("id",renditionId);
  if(!unresolved){const allRejected=(items??[]).length>0&&(items??[]).every((x:any)=>x.review_status==="Rechazada");let finalStatus=allRejected?"Rechazada":"Aprobada";let autoSettled=false;if(!allRejected){const {data:current}=await supabase.from("renditions").select("previous_balance,company_funds").eq("id",renditionId).single();const balance=calculateRenditionBalance({previousBalance:Number(current?.previous_balance||0),companyFunds:Number(current?.company_funds||0),authorized:total,paid:0});if(balance.amountToPay===0){finalStatus="Pagada";autoSettled=true;}}await supabase.from("renditions").update({status:finalStatus,total_authorized:total,amount_paid:0,paid_at:autoSettled?new Date().toISOString():null,paid_by:autoSettled?profile.id:null,payment_observation:autoSettled?"Cierre automático sin pago: saldo a favor de la empresa o saldo cero.":null,reviewed_by:profile.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",renditionId);}
 }
 await log(supabase,profile,renditionId,"expense_reviewed",{expense_id:expenseId,decision,observation});revalidatePath("/rendiciones");
}

export async function deleteRenditionExpense(fd:FormData){
 const {supabase,user,profile}=await ctx();await requireCapability(supabase,profile,CAPABILITIES.RENDITION_SUBMIT,"Sin permiso para eliminar gastos.");
 const renditionId=txt(fd.get("rendition_id")),expenseId=txt(fd.get("expense_id"));
 const {data:r}=await supabase.from("renditions").select("status,creator_user_id").eq("id",renditionId).single();
 if(!r||r.creator_user_id!==user.id)throw new Error("Solo quien creó la rendición puede eliminar sus gastos.");
 if(!editable.has(r.status))throw new Error("La rendición ya no permite eliminar gastos.");
 const {data:g}=await supabase.from("rendition_expenses").select("id,document_id").eq("id",expenseId).eq("rendition_id",renditionId).single();
 if(!g)throw new Error("Gasto no encontrado.");
 if(g.document_id){
  const {data:doc}=await supabase.from("documents").select("storage_path").eq("id",g.document_id).single();
  if(doc?.storage_path){const {error:storageError}=await supabase.storage.from("rendition-documents").remove([doc.storage_path]);if(storageError)throw new Error("No se pudo eliminar el comprobante asociado.");}
  const {error:docError}=await supabase.from("documents").delete().eq("id",g.document_id);if(docError)throw new Error("No se pudo eliminar el registro del comprobante.");
 }
 const {error:deleteError}=await supabase.from("rendition_expenses").delete().eq("id",expenseId).eq("rendition_id",renditionId);if(deleteError)throw new Error("No se pudo eliminar el gasto.");
 const {data:items,error:itemsError}=await supabase.from("rendition_expenses").select("presented_amount").eq("rendition_id",renditionId);if(itemsError)throw new Error("Gasto eliminado, pero no se pudo recalcular el total.");
 const total=(items??[]).reduce((n:number,x:any)=>n+Number(x.presented_amount||0),0);const {error:totalError}=await supabase.from("renditions").update({total_presented:total,updated_at:new Date().toISOString()}).eq("id",renditionId);if(totalError)throw new Error("Gasto eliminado, pero no se pudo actualizar el total.");
 await log(supabase,profile,renditionId,"expense_deleted",{expense_id:expenseId,document_id:g.document_id||null});revalidatePath("/rendiciones");revalidatePath(`/rendiciones/${renditionId}`);
}
