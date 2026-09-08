"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function allowedContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role)) throw new Error("No autorizado para configurar materiales");
  return {supabase,user,profile};
}

export async function loadMaterialProfile(contractId:string,installationId:string|null){
  const {supabase}=await allowedContext();
  if(!contractId) throw new Error("Contrato obligatorio");
  const {data:contract,error:contractError}=await supabase.from("contracts").select("id,name,active,client_id,net_budget").eq("id",contractId).eq("active",true).single();
  if(contractError||!contract) throw new Error("Contrato no válido o inactivo");
  let installation:any=null;
  if(installationId){
    const result=await supabase.from("installations").select("id,contract_id,name").eq("id",installationId).eq("contract_id",contractId).eq("active",true).single();
    if(result.error||!result.data) throw new Error("Instalación no válida para este contrato");
    installation=result.data;
  }
  const [{data:assignments,error:assignmentError},{data:materials,error:materialsError},{data:clientCatalog,error:catalogError},{data:history,error:historyError}]=await Promise.all([
    installationId
      ? supabase.from("contract_materials").select("id,material_id,installation_id,authorized,authorized_qty,coverage_status,notes,updated_at,manually_overridden").eq("contract_id",contractId).or(`installation_id.is.null,installation_id.eq.${installationId}`)
      : supabase.from("contract_materials").select("id,material_id,installation_id,authorized,authorized_qty,coverage_status,notes,updated_at,manually_overridden").eq("contract_id",contractId).is("installation_id",null),
    supabase.from("materials").select("id,family,name,presentation,unit,supplier_code,current_net_price,active").eq("active",true).order("family").order("name"),
    supabase.from("client_materials").select("material_id,authorized").eq("client_id",contract.client_id),
    installationId
      ? supabase.from("material_delivery_history").select("material_id,quantity,unit_net_price,period_label,source_reference,delivered_at").eq("contract_id",contractId).eq("installation_id",installationId)
      : Promise.resolve({data:[],error:null}) as any
  ]);
  if(assignmentError) throw assignmentError;if(materialsError) throw materialsError;if(catalogError) throw catalogError;if(historyError) throw historyError;
  const catalogConfigured=(clientCatalog||[]).length>0;
  const allowed=new Set((clientCatalog||[]).filter((x:any)=>x.authorized).map((x:any)=>x.material_id));
  const effectiveMaterials=catalogConfigured?(materials||[]).filter((m:any)=>allowed.has(m.id)):(materials||[]);
  const historyByMaterial:Record<string,any>={};
  for(const item of history||[]){
    const key=item.material_id;const qty=Number(item.quantity||0);const price=item.unit_net_price==null?null:Number(item.unit_net_price);
    if(!historyByMaterial[key]) historyByMaterial[key]={count:0,total_qty:0,max_qty:0,total_net:0,periods:[]};
    const row=historyByMaterial[key];row.count+=1;row.total_qty+=qty;row.max_qty=Math.max(row.max_qty,qty);if(price!=null)row.total_net+=qty*price;
    row.periods.push({quantity:qty,unit_net_price:price,period_label:item.period_label,source_reference:item.source_reference,delivered_at:item.delivered_at});
  }
  Object.values(historyByMaterial).forEach((row:any)=>{row.average_qty=row.count?row.total_qty/row.count:0;});
  return {contract,installation,assignments:assignments||[],materials:effectiveMaterials,clientCatalogConfigured:catalogConfigured,historyByMaterial};
}

type SaveInput={contract_id:string;installation_id:string|null;material_id:string;assigned:boolean;authorized_qty:number;period_type?:string|null;notes?:string|null;override_reason?:string|null};
export async function saveMaterialProfileConfig(input:SaveInput){
  const {supabase,user,profile}=await allowedContext();
  const {data:contract,error:contractError}=await supabase.from("contracts").select("client_id").eq("id",input.contract_id).single();
  if(contractError||!contract) throw new Error("Contrato no válido");
  const {data:catalog}=await supabase.from("client_materials").select("material_id,authorized").eq("client_id",contract.client_id);
  if((catalog||[]).length>0&&!catalog?.some((x:any)=>x.material_id===input.material_id&&x.authorized)) throw new Error("Este material no está autorizado en el catálogo del cliente");
  const {data:existing}=await supabase.from("contract_materials").select("id,authorized,authorized_qty,notes,manually_overridden").eq("contract_id",input.contract_id).eq("material_id",input.material_id).filter("installation_id",input.installation_id?"eq":"is",input.installation_id||null).maybeSingle();
  const nextQty=input.assigned?Number(input.authorized_qty||0):0;
  const changedQty=existing&&Number(existing.authorized_qty||0)!==nextQty;
  if(changedQty&&!String(input.override_reason||"").trim()) throw new Error("Indica el motivo del ajuste del máximo autorizado");
  const row={contract_id:input.contract_id,installation_id:input.installation_id,material_id:input.material_id,authorized:Boolean(input.assigned),authorized_qty:nextQty,coverage_status:input.assigned?"included":"not_included",coverage_basis:input.installation_id?"installation_profile":"contract_profile",coverage_confidence:"confirmed",manually_overridden:Boolean(existing?.manually_overridden||changedQty),notes:input.notes||null,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from("contract_materials").upsert(row,{onConflict:"contract_id,installation_id,material_id"}).select("id,authorized,authorized_qty,manually_overridden").single();
  if(error) throw new Error(error.message);
  if(input.period_type){
    const periodValue=({Mensual:1,Bimensual:2,Trimestral:3,Cuatrimestral:4,Semestral:6} as Record<string,number>)[input.period_type]||null;
    await supabase.from("contract_limits").upsert({contract_id:input.contract_id,installation_id:input.installation_id,material_id:input.material_id,period_type:input.period_type,period_value:periodValue,quantity_limit:nextQty,active:true},{onConflict:"contract_id,installation_id,material_id"});
  }
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Perfil de materiales",action:changedQty?"Ajustar máximo autorizado":"Guardar perfil",entity_table:"contract_materials",entity_id:data.id,old_data:existing||null,new_data:data,observation:changedQty?String(input.override_reason||"").trim():null});
  revalidatePath("/");return data;
}

export async function clearInstallationMaterialException(contractId:string,installationId:string,materialId:string){
  const {supabase}=await allowedContext();
  if(!contractId||!installationId||!materialId) throw new Error("Datos incompletos para volver al perfil general");
  const {error}=await supabase.from("contract_materials").delete().eq("contract_id",contractId).eq("installation_id",installationId).eq("material_id",materialId);
  if(error) throw new Error(error.message);revalidatePath("/");return {ok:true};
}

export async function loadInstallationMaterialProfile(contractId:string,installationId:string){return loadMaterialProfile(contractId,installationId);}
export async function saveInstallationMaterialConfig(input:Omit<SaveInput,"installation_id">&{installation_id:string}){return saveMaterialProfileConfig(input);}
