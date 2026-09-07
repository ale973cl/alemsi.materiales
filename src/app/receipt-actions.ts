"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

export async function registerPurchaseOrderReceipt(formData:FormData){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");

  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Admin","Bodega"].includes(profile.role)){
    throw new Error("No autorizado para registrar recepción");
  }

  const purchaseOrderId=String(formData.get("purchase_order_id")||"").trim();
  const shippingCondition=String(formData.get("shipping_condition")||"Incluido").trim();
  const freightNet=Number(formData.get("freight_net")||0);
  const observation=String(formData.get("observation")||"").trim()||null;
  const lines=JSON.parse(String(formData.get("lines")||"[]"));

  if(!purchaseOrderId)throw new Error("Selecciona una orden de compra");
  if(!Array.isArray(lines)||!lines.some((line:any)=>Number(line.received_qty)>0)){
    throw new Error("Ingresa al menos una cantidad recibida mayor a cero");
  }
  if(shippingCondition==="Por pagar"&&freightNet<=0){
    throw new Error("Ingresa el valor neto del flete por pagar");
  }

  const {data,error}=await supabase.rpc("register_purchase_order_receipt_v2",{
    p_purchase_order_id:purchaseOrderId,
    p_lines:lines,
    p_shipping_condition:shippingCondition,
    p_freight_net:shippingCondition==="Por pagar"?freightNet:0,
    p_observation:observation,
  });
  if(error)throw new Error(error.message);

  revalidatePath("/");
  return{ok:true,id:data};
}
