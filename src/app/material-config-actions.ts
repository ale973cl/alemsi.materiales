"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

async function context(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role)) throw new Error("No autorizado para configurar materiales");
  return {supabase,user,profile};
}

const value=(formData:FormData,key:string)=>String(formData.get(key)||"").trim();
const nullable=(v:string)=>v||null;

async function writeSuppliers(supabase:any, materialId:string, formData:FormData){
  const selected=[1,2,3].map(priority=>({
    priority,
    supplier_id:value(formData,`supplier_${priority}`),
    supplier_code:value(formData,`supplier_code_${priority}`)
  })).filter(x=>x.supplier_id);

  const ids=selected.map(x=>x.supplier_id);
  if(ids.length!==new Set(ids).size) throw new Error("Un proveedor no puede ocupar más de una prioridad en el mismo material");

  if(ids.length){
    const {data:valid,error}=await supabase.from("suppliers").select("id").in("id",ids).eq("active",true);
    if(error) throw error;
    if((valid||[]).length!==ids.length) throw new Error("Uno de los proveedores seleccionados está inactivo o no existe");
  }

  const {data:previous}=await supabase.from("supplier_materials").select("supplier_id,net_price").eq("material_id",materialId).eq("active",true);
  const oldPrice=new Map((previous||[]).map((x:any)=>[x.supplier_id,x.net_price]));
  const {error:disableError}=await supabase.from("supplier_materials").update({active:false}).eq("material_id",materialId).eq("active",true);
  if(disableError) throw disableError;

  const today=new Date().toISOString().slice(0,10);
  for(const item of selected){
    const row={supplier_id:item.supplier_id,material_id:materialId,priority:item.priority,supplier_code:nullable(item.supplier_code),net_price:oldPrice.get(item.supplier_id)??null,effective_from:today,active:true};
    const {error}=await supabase.from("supplier_materials").upsert(row,{onConflict:"supplier_id,material_id,effective_from"});
    if(error) throw error;
  }
  return selected;
}

export async function createMaterialConfigured(formData:FormData){
  const {supabase,user,profile}=await context();
  const family=value(formData,"family"), name=value(formData,"name");
  const presentation=value(formData,"presentation"), unit=value(formData,"unit");
  const currentNetPrice=Number(formData.get("current_net_price")||0);
  if(!family||!name) throw new Error("Familia y producto son obligatorios");
  if(!Number.isFinite(currentNetPrice)||currentNetPrice<0) throw new Error("Valor neto no válido");
  const primaryCode=value(formData,"supplier_code_1");
  const {data:material,error}=await supabase.from("materials").insert({family,name,presentation:nullable(presentation),unit:nullable(unit),supplier_code:nullable(primaryCode),current_net_price:currentNetPrice,active:true,price_source_note:"Ingreso manual trazable"}).select("id,name,family,presentation,unit,current_net_price").single();
  if(error) throw error;
  try{await writeSuppliers(supabase,material.id,formData);}catch(err){await supabase.from("materials").delete().eq("id",material.id);throw err;}
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Maestro de materiales",action:"Crear producto con proveedores",entity_table:"materials",entity_id:material.id,new_data:{material,providers:[1,2,3].map(p=>value(formData,`supplier_${p}`)).filter(Boolean)}});
  revalidatePath("/");
  return {ok:true,message:"Producto creado y proveedores asociados"};
}

export async function getMaterialConfiguration(materialId:string){
  const {supabase}=await context();
  const [{data:material,error:materialError},{data:links,error:linksError}]=await Promise.all([
    supabase.from("materials").select("id,family,name,presentation,unit").eq("id",materialId).single(),
    supabase.from("supplier_materials").select("supplier_id,priority,supplier_code,net_price,suppliers(id,legal_name,fantasy_name,active)").eq("material_id",materialId).eq("active",true).order("priority")
  ]);
  if(materialError) throw materialError;
  if(linksError) throw linksError;
  return {ok:true,material,links:links||[]};
}

export async function updateMaterialConfiguration(formData:FormData){
  const {supabase,user,profile}=await context();
  const materialId=value(formData,"material_id");
  const family=value(formData,"family"), name=value(formData,"name"), presentation=value(formData,"presentation"), unit=value(formData,"unit");
  if(!materialId||!family||!name) throw new Error("Material, familia y producto son obligatorios");
  const {data:old,error:oldError}=await supabase.from("materials").select("id,family,name,presentation,unit,supplier_code").eq("id",materialId).single();
  if(oldError) throw oldError;
  const primaryCode=value(formData,"supplier_code_1");
  const {data:updated,error}=await supabase.from("materials").update({family,name,presentation:nullable(presentation),unit:nullable(unit),supplier_code:nullable(primaryCode),updated_at:new Date().toISOString()}).eq("id",materialId).select("id,family,name,presentation,unit,supplier_code").single();
  if(error) throw error;
  const providers=await writeSuppliers(supabase,materialId,formData);
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Maestro de materiales",action:"Configurar material y proveedores",entity_table:"materials",entity_id:materialId,old_data:old,new_data:{material:updated,providers}});
  revalidatePath("/");
  return {ok:true,message:"Configuración guardada correctamente"};
}
