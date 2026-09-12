"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {enqueueModuleEmail} from "@/lib/email-queue";

async function context(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role))throw new Error("No autorizado para enviar órdenes de compra");
  return{supabase,user,profile};
}

export async function queuePurchaseOrderEmail(formData:FormData){
  const {supabase,user,profile}=await context();
  const id=String(formData.get("purchase_order_id")||"").trim();
  if(!id)throw new Error("Orden de compra no válida");
  const {data:po,error}=await supabase.from("purchase_orders").select("id,order_number,status,total_net,total_amount,currency,suppliers(legal_name,purchase_order_email,commercial_email)").eq("id",id).single();
  if(error||!po)throw new Error("Orden de compra no encontrada");
  const supplier:any=Array.isArray(po.suppliers)?po.suppliers[0]:po.suppliers;
  const recipient=String(supplier?.purchase_order_email||supplier?.commercial_email||"").trim();
  if(!recipient)throw new Error("El proveedor no tiene correo de órdenes de compra configurado");
  const folio=po.order_number||po.id;
  const queued=await enqueueModuleEmail(supabase,{
    module:"purchase_orders",
    event:"supplier_order_ready",
    emailType:"purchase_order_supplier",
    relatedTable:"purchase_orders",
    relatedId:po.id,
    to:[recipient],
    subject:`Orden de compra ${folio} · ALEMSI`,
    summary:"ALEMSI ha generado una orden de compra para su gestión. Los datos principales quedan registrados en este correo transaccional.",
    facts:{"Orden de compra":folio,"Proveedor":supplier?.legal_name||"—","Estado":po.status||"—","Total neto":Number(po.total_net||0),"Moneda":po.currency||"CLP"},
    idempotencyKey:`purchase_orders:supplier_order_ready:${po.id}`
  });
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Órdenes de compra",action:queued.queued?"Encolar correo a proveedor":"Correo a proveedor ya en cola",entity_table:"purchase_orders",entity_id:po.id,new_data:{recipient,email_queue_id:(queued as any).id||null,status:(queued as any).status||null}});
  revalidatePath("/");
  revalidatePath(`/ordenes-compra/${id}`);
}
