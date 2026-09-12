"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

async function ctx(roles:string[]){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sesión no válida");const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();if(!profile?.active||!roles.includes(profile.role))throw new Error("No autorizado para esta operación");return{supabase,user,profile};}

export async function registerPurchaseOrderReceipt(formData:FormData){
 const {supabase,user,profile}=await ctx(["Admin Total","Admin","Bodega"]);
 const purchaseOrderId=String(formData.get("purchase_order_id")||"").trim();
 const documentType=String(formData.get("document_type")||"").trim();
 const documentFolio=String(formData.get("document_folio")||"").trim();
 const documentDate=String(formData.get("document_date")||"").trim();
 const documentNet=Number(formData.get("document_net")||0);
 const documentVat=Number(formData.get("document_vat")||0);
 const documentTotal=Number(formData.get("document_total")||0);
 const shippingCondition=String(formData.get("shipping_condition")||"Incluido").trim();
 const freightNet=Number(formData.get("freight_net")||0);
 const observation=String(formData.get("observation")||"").trim()||null;
 const lines=JSON.parse(String(formData.get("lines")||"[]"));
 if(!purchaseOrderId)throw new Error("Selecciona una orden de compra");
 if(!["Factura","Boleta","Guía de despacho","Otro"].includes(documentType))throw new Error("Selecciona el tipo de documento");
 if(!documentFolio)throw new Error("El folio del documento es obligatorio");
 if(!documentDate)throw new Error("La fecha del documento es obligatoria");
 if(!Array.isArray(lines)||!lines.some((l:any)=>Number(l.received_qty)>0))throw new Error("Ingresa al menos una cantidad recibida mayor a cero");
 if(shippingCondition==="Por pagar"&&freightNet<=0)throw new Error("Ingresa el valor neto del flete por pagar");
 const {data:po,error:poError}=await supabase.from("purchase_orders").select("id,supplier_id").eq("id",purchaseOrderId).single();if(poError||!po)throw new Error("OC no encontrada");
 const {data:receipt,error}=await supabase.from("receipts").insert({purchase_order_id:purchaseOrderId,supplier_id:po.supplier_id,invoice_number:documentType==="Factura"?documentFolio:null,invoice_date:documentDate,invoice_net:documentNet,vat_amount:documentVat,status:"Pendiente cotejo",received_by:user.id,received_at:new Date().toISOString(),shipping_condition:shippingCondition,freight_net:shippingCondition==="Por pagar"?freightNet:0,document_type:documentType,document_folio:documentFolio,document_date:documentDate,document_net:documentNet,document_total:documentTotal,reconciliation_status:"Pendiente cotejo",inventory_posted:false}).select("id").single();
 if(error||!receipt)throw new Error(error?.message||"No se pudo registrar el documento");
 const lineRows=lines.filter((l:any)=>Number(l.received_qty)>0).map((l:any)=>({receipt_id:receipt.id,purchase_order_line_id:l.purchase_order_line_id,material_id:l.material_id,received_qty:Number(l.received_qty),actual_unit_net:Number(l.actual_unit_net||0),line_net:Number(l.received_qty)*Number(l.actual_unit_net||0),difference_note:null}));
 const {error:lineError}=await supabase.from("receipt_lines").insert(lineRows);if(lineError){await supabase.from("receipts").delete().eq("id",receipt.id);throw new Error(lineError.message);}
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Recepción",action:"Registrar documento para cotejo",entity_table:"receipts",entity_id:receipt.id,new_data:{purchase_order_id:purchaseOrderId,document_type:documentType,document_folio:documentFolio,document_date:documentDate,document_net:documentNet,document_total:documentTotal},observation});
 revalidatePath("/");return{ok:true,id:receipt.id};
}
