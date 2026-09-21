"use server";
import {CAPABILITIES,roleCan} from "@/lib/authorization";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {enqueueModuleEmail} from "@/lib/email-queue";

async function context(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!roleCan(profile.role,CAPABILITIES.PURCHASE_ORDER_MANAGE))throw new Error("No autorizado para derivar órdenes de compra");
  return{supabase,user,profile};
}

export async function derivePurchaseOrderSafe(formData:FormData){
  const {supabase,user,profile}=await context();
  const id=String(formData.get("purchase_order_id")||"").trim();
  if(!id)throw new Error("Orden de compra no válida");
  const {data:po,error}=await supabase.from("purchase_orders").select("id,order_number,total_net,suppliers(legal_name,purchase_order_email)").eq("id",id).single();
  if(error||!po)throw new Error("Orden de compra no encontrada");
  const supplier:any=Array.isArray(po.suppliers)?po.suppliers[0]:po.suppliers;
  const reference=po.order_number||po.id;
  const {data:existingMovement}=await supabase.from("finance_movements").select("id,status").eq("movement_type","Pago OC").eq("reference",reference).limit(1).maybeSingle();
  if(!existingMovement){
    const {error:movementError}=await supabase.from("finance_movements").insert({movement_type:"Pago OC",status:"Pendiente",amount_net:Number(po.total_net||0),reference,recipient_name:supplier?.legal_name,recipient_email:supplier?.purchase_order_email||null,created_by:user.id,observation:"Derivada por Operaciones/Gerencia; costo neto, IVA separado al registrar factura."});
    if(movementError)throw movementError;
  }
  const {data:fin}=await supabase.from("user_profiles").select("email").eq("role","Finanzas").eq("active",true);
  const financeEmails=[...new Set((fin||[]).map((x:any)=>String(x.email||"").trim().toLowerCase()).filter(Boolean))];
  const queued=financeEmails.length?await enqueueModuleEmail(supabase,{module:"purchase_orders",event:"derived_to_finance",emailType:"purchase_order_derived",relatedTable:"purchase_orders",relatedId:po.id,to:financeEmails,subject:`Orden de compra ${reference} · ALEMSI`,summary:"Una orden de compra fue derivada a Finanzas para continuar con el circuito de pago, factura y recepción.",facts:{"Orden de compra":reference,"Proveedor":supplier?.legal_name||"—","Total neto":Number(po.total_net||0),"Derivada por":profile.full_name||profile.email},idempotencyKey:`purchase_orders:derived_to_finance:${po.id}`}):{queued:false,reason:"Sin usuarios activos de Finanzas"};
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Órdenes de compra",action:existingMovement?"Revisar derivación existente a Finanzas":"Derivar a Finanzas",entity_table:"purchase_orders",entity_id:po.id,new_data:{finance_movement_id:existingMovement?.id||null,email_queue_id:(queued as any).id||null,email_status:(queued as any).status||null}});
  revalidatePath("/");
  return{ok:true,alreadyDerived:Boolean(existingMovement),emailStatus:(queued as any).status||null};
}
