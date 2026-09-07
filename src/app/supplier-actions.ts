"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

async function supplierContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role))throw new Error("No autorizado para administrar proveedores");
  return{supabase,user,profile};
}

const text=(formData:FormData,key:string)=>String(formData.get(key)||"").trim()||null;
const numberOrNull=(formData:FormData,key:string)=>{const raw=String(formData.get(key)||"").trim();return raw===""?null:Number(raw)};

export async function saveSupplier(formData:FormData){
  const {supabase,user,profile}=await supplierContext();
  const id=String(formData.get("id")||"").trim();
  const legal_name=String(formData.get("legal_name")||"").trim();
  if(!legal_name)throw new Error("La razón social o nombre del proveedor es obligatorio");
  const payload={
    legal_name,
    fantasy_name:text(formData,"fantasy_name"),
    rut:text(formData,"rut"),
    address:text(formData,"address"),
    region:text(formData,"region"),
    city:text(formData,"city"),
    commune:text(formData,"commune"),
    contact_name:text(formData,"contact_name"),
    phone:text(formData,"phone"),
    commercial_email:text(formData,"commercial_email"),
    purchase_order_email:text(formData,"purchase_order_email"),
    billing_email:text(formData,"billing_email"),
    dispatch_email:text(formData,"dispatch_email"),
    website:text(formData,"website"),
    payment_terms:text(formData,"payment_terms"),
    lead_time_days:numberOrNull(formData,"lead_time_days"),
    minimum_order_net:numberOrNull(formData,"minimum_order_net"),
    conditions:text(formData,"conditions"),
    notes:text(formData,"notes"),
    active:String(formData.get("active")||"")==="true",
    updated_at:new Date().toISOString(),
  };
  let result:any;
  let action="Crear proveedor";
  let old_data:any=null;
  if(id){
    const old=await supabase.from("suppliers").select("*").eq("id",id).single();old_data=old.data;
    result=await supabase.from("suppliers").update(payload).eq("id",id).select("*").single();action="Editar proveedor";
  }else{
    result=await supabase.from("suppliers").insert(payload).select("*").single();
  }
  if(result.error||!result.data)throw result.error||new Error("No se pudo guardar el proveedor");
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Proveedores",action,entity_table:"suppliers",entity_id:result.data.id,old_data,new_data:result.data});
  revalidatePath("/");
  return{ok:true,supplier:result.data};
}
