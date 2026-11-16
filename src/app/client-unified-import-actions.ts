"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {
  buildUnifiedPlan,
  runUnifiedCommit,
  type ExistingAssignment,
  type ExistingClient,
  type ExistingImportData,
  type ExistingMaterial,
  type UnifiedCsvRow,
  type UnifiedImportExecutor,
} from "@/lib/client-unified-import";

const MAX_ROWS=2000;

async function importContext(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia"].includes(profile.role))throw new Error("No autorizado para importar clientes y contratos");
 return{supabase,user,profile};
}

function validateRows(rows:UnifiedCsvRow[]){
 if(!Array.isArray(rows)||!rows.length)throw new Error("El CSV no contiene filas");
 if(rows.length>MAX_ROWS)throw new Error(`El CSV supera el máximo de ${MAX_ROWS} filas`);
 for(const [index,row] of rows.entries()){
  if(!row||typeof row!=="object")throw new Error(`Fila ${index+2}: formato inválido`);
  for(const value of Object.values(row))if(value!=null&&typeof value!=="string"&&typeof value!=="number")throw new Error(`Fila ${index+2}: contiene un valor inválido`);
 }
}

async function loadExisting(supabase:any):Promise<ExistingImportData>{
 const {data:clients,error}=await supabase.from("clients").select("id,legal_name,rut,central_email,central_phone,address,contracts(id,name,code,net_budget,installations(id,name,region,city,commune,address,delivery_contact_name,delivery_email))");
 if(error)throw new Error(`No se pudo leer la estructura existente: ${error.message}`);
 const {data:materials,error:materialError}=await supabase.from("materials").select("id,name,presentation,unit,supplier_code").eq("active",true);
 if(materialError)throw new Error(`No se pudo leer el maestro de materiales: ${materialError.message}`);
 const contractIds=[...new Set((clients||[]).flatMap((c:any)=>(c.contracts||[]).map((k:any)=>k.id)))].filter(Boolean) as string[];
 const assignments:ExistingAssignment[]=[];
 for(let i=0;i<contractIds.length;i+=150){
  const chunk=contractIds.slice(i,i+150);
  const {data,error:assignmentError}=await supabase.from("contract_materials").select("id,contract_id,material_id,installation_id,authorized,authorized_qty,notes").in("contract_id",chunk);
  if(assignmentError)throw new Error(`No se pudieron leer los materiales contractuales: ${assignmentError.message}`);
  assignments.push(...(data||[]));
 }
 return{clients:(clients||[]) as ExistingClient[],materials:(materials||[]) as ExistingMaterial[],assignments};
}

export async function previewUnifiedClientCsv(rows:UnifiedCsvRow[]){
 const {supabase}=await importContext();
 validateRows(rows);
 const existing=await loadExisting(supabase);
 const plan=buildUnifiedPlan(rows,existing);
 return{ok:true,summary:plan.summary,details:plan.details};
}

export async function confirmUnifiedClientCsv(rows:UnifiedCsvRow[],fileName?:string){
 const {supabase,user,profile}=await importContext();
 validateRows(rows);
 const existing=await loadExisting(supabase);
 const plan=buildUnifiedPlan(rows,existing);
 if(!plan.summary.newTotal){
  return{ok:true,message:"No hay registros nuevos: todo lo válido ya existe y se conservó sin cambios.",summary:plan.summary,result:{clients:0,contracts:0,installations:0,assignments:0}};
 }

 const executor:UnifiedImportExecutor={
  createClient:async(op)=>{
   const payload:any={legal_name:op.name,rut:op.rut,active:true,tender_data:{},updated_at:new Date().toISOString()};
   if(op.email)payload.central_email=op.email;
   if(op.phone)payload.central_phone=op.phone;
   const {data,error}=await supabase.from("clients").insert(payload).select("id").single();
   if(error)throw new Error(`Cliente ${op.name}: ${error.message}`);
   return data.id;
  },
  createContract:async(op,clientId)=>{
   const rules:any={};
   if(op.periodicity)rules.periodicity=op.periodicity;
   const payload:any={client_id:clientId,name:op.name,code:op.code,net_budget:op.budget??0,rules,active:true};
   const {data,error}=await supabase.from("contracts").insert(payload).select("id").single();
   if(error)throw new Error(`Contrato ${op.name}: ${error.message}`);
   return data.id;
  },
  createInstallation:async(op,contractId)=>{
   const payload:any={contract_id:contractId,name:op.name,active:true};
   if(op.region)payload.region=op.region;
   if(op.city)payload.city=op.city;
   if(op.commune)payload.commune=op.commune;
   if(op.address)payload.address=op.address;
   if(op.delivery_contact)payload.delivery_contact_name=op.delivery_contact;
   if(op.delivery_email)payload.delivery_email=op.delivery_email;
   const {data,error}=await supabase.from("installations").insert(payload).select("id").single();
   if(error)throw new Error(`Instalación ${op.name}: ${error.message}`);
   return data.id;
  },
  createAssignment:async(op,contractId,installationId)=>{
   const {error}=await supabase.rpc("save_client_profile_material_config",{
    p_contract_id:contractId,
    p_installation_id:installationId,
    p_material_id:op.materialId,
    p_assigned:true,
    p_authorized_qty:op.scope==="contrato"?0:Number(op.quantity||0),
    p_period_type:null,
    p_period_value:null,
    p_quantity_limit:null,
    p_net_amount_limit:null,
    p_coverage_status:"included",
    p_notes:op.notes,
   });
   if(error)throw new Error(`Material ${op.materialName}: ${error.message}`);
   let query=supabase.from("contract_materials").select("id").eq("contract_id",contractId).eq("material_id",op.materialId);
   query=installationId?query.eq("installation_id",installationId):query.is("installation_id",null);
   const {data,error:readError}=await query.maybeSingle();
   if(readError||!data)throw new Error(`Material ${op.materialName}: no se pudo verificar el registro creado`);
   return data.id;
  },
  remove:async(table,id)=>{
   const {error}=await supabase.from(table).delete().eq("id",id);
   if(error)throw new Error(error.message);
  },
 };

 const result=await runUnifiedCommit(plan,executor);
 revalidatePath("/");
 await supabase.from("activity_log").insert({
  actor_id:user.id,
  actor_name:profile.full_name||profile.email,
  module:"Clientes e instalaciones",
  action:"Importación única CSV",
  entity_table:"clients",
  new_data:{file:String(fileName||"").slice(0,200),summary:plan.summary,result},
  observation:"Cliente, contratos, instalaciones y materiales contractuales importados en una sola operación. Los conflictos y las cantidades ya configuradas no se modificaron.",
 });
 const omitted=plan.summary.conflicts+plan.summary.duplicates;
 return{
  ok:true,
  message:`Importación completada: ${result.clients} clientes, ${result.contracts} contratos, ${result.installations} instalaciones y ${result.assignments} asignaciones de material.${omitted?` Se omitieron ${plan.summary.conflicts} conflictos y ${plan.summary.duplicates} filas duplicadas.`:""}`,
  summary:plan.summary,
  result,
 };
}
