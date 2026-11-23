"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {receiptSingleStepEnabled} from "@/lib/receipt-transactions";
import {isClosedPurchaseOrder,isCancelledPurchaseOrder} from "@/lib/purchase-order-balance";
import {parseReceiptLines,validateReceiptDraft} from "@/lib/receipt-validation";

async function ctx(roles:string[]){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sesión no válida");const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();if(!profile?.active||!roles.includes(profile.role))throw new Error("No autorizado para esta operación");return{supabase,user,profile};}

export async function registerPurchaseOrderReceipt(formData:FormData){
 const {supabase}=await ctx(["Admin Total","Admin","Bodega"]);
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
 const pendingResolution=JSON.parse(String(formData.get("pending_resolution")||"[]"));
 const lines=validateReceiptDraft({documentType,folio:documentFolio,date:documentDate,net:documentNet,vat:documentVat,total:documentTotal,lines:parseReceiptLines(formData.get("lines")),withOrder:true,shipping:shippingCondition,freight:freightNet});
 if(!purchaseOrderId)throw new Error("Selecciona una orden de compra");
 if(!["Factura","Boleta","Guía de despacho","Otro"].includes(documentType))throw new Error("Selecciona el tipo de documento");
 if(!documentFolio)throw new Error("El folio del documento es obligatorio");
 if(!documentDate)throw new Error("La fecha del documento es obligatoria");
 if(!Array.isArray(lines)||!lines.some((l:any)=>Number(l.received_qty)>0))throw new Error("Ingresa al menos una cantidad recibida mayor a cero");
 if(shippingCondition==="Por pagar"&&freightNet<=0)throw new Error("Ingresa el valor neto del flete por pagar");
 // No legacy two-stage writes from this one-confirmation interface.
 if(!receiptSingleStepEnabled())throw new Error("Recepción única no habilitada: falta activar el circuito V3 en una base aislada de Preview. No se registró nada.");
 const supplierRut=String(formData.get("supplier_rut")||"").trim();
 if(!supplierRut)throw new Error("Confirma el RUT del emisor que figura en la factura antes de guardar.");
 const {data:confirmed,error:confirmedError}=await supabase.rpc("confirm_receipt_once_v3",{
  p_document:{purchase_order_id:purchaseOrderId,supplier_rut:supplierRut,document_type:documentType,document_folio:documentFolio,document_date:documentDate,document_net:documentNet,vat_amount:documentVat,document_total:documentTotal,shipping_condition:shippingCondition,freight_net:shippingCondition==="Por pagar"?freightNet:0,observation,pending_resolution:pendingResolution},
  p_lines:lines
 });
 if(confirmedError||!confirmed?.id)throw new Error(confirmedError?.message||"No se pudo confirmar recepción e inventario. La operación se ha revertido.");
 revalidatePath("/");return{ok:true,id:String(confirmed.id),inventory_posted:true,status:String(confirmed.status||"Conforme"),outstanding:Number(confirmed.outstanding||0)};

}

export async function closePurchaseOrderReceipt(purchaseOrderId:string){
 const {supabase,user,profile}=await ctx(["Admin Total","Admin","Bodega"]);
 if(!purchaseOrderId)throw new Error("Selecciona la OC a cerrar");
 const {data:po,error:poError}=await supabase.from("purchase_orders").select("id,order_number,status,purchase_order_lines(id,ordered_qty)").eq("id",purchaseOrderId).single();
 if(poError||!po)throw new Error("No se encontró la OC");
 if(isClosedPurchaseOrder(po.status)||isCancelledPurchaseOrder(po.status))throw new Error("La OC ya está cerrada o anulada");
 const {data:receipts,error:receiptError}=await supabase.from("receipts").select("id,inventory_posted,receipt_lines(purchase_order_line_id,received_qty)").eq("purchase_order_id",purchaseOrderId);
 if(receiptError)throw new Error(receiptError.message);
 if(!(receipts||[]).length)throw new Error("No se puede cerrar una OC sin factura o documento recibido");
 if((receipts||[]).some((r:any)=>!r.inventory_posted))throw new Error("Existen recepciones pendientes de cotejo. Valídalas y carga el inventario antes de cerrar.");
 const ordered=new Map<string,number>();
 for(const l of (po as any).purchase_order_lines||[])ordered.set(String(l.id),Number(l.ordered_qty||0));
 const received=new Map<string,number>();
 for(const r of receipts||[])for(const l of (r as any).receipt_lines||[]){
  const key=String(l.purchase_order_line_id||"");received.set(key,(received.get(key)||0)+Number(l.received_qty||0));
 }
 if(!received.size)throw new Error("No existen productos validados que cerrar");
 const totalOrdered=[...ordered.values()].reduce((a,b)=>a+b,0);
 const totalReceived=[...received.values()].reduce((a,b)=>a+b,0);
 const outstanding=[...ordered.entries()].reduce((sum,[lineId,qty])=>sum+Math.max(0,qty-(received.get(lineId)||0)),0);
 const status=outstanding>0?"Cerrada incompleta":"Cerrada";
 const {error:updateError}=await supabase.from("purchase_orders").update({status}).eq("id",purchaseOrderId);
 if(updateError)throw new Error("No se pudo cerrar la OC: "+updateError.message);
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Órdenes de compra",action:"Cerrar orden de compra con recepción",entity_table:"purchase_orders",entity_id:purchaseOrderId,new_data:{status,ordered:totalOrdered,received:totalReceived,unfilled:outstanding,receipt_ids:(receipts||[]).map((r:any)=>r.id)}});
 revalidatePath("/");
 return{ok:true,status,totalOrdered,totalReceived,outstanding};
}

export async function resolvePurchaseOrderMaterial(input:{purchaseOrderLineId:string;materialId:string}){
 const {supabase,user,profile}=await ctx(["Admin Total","Admin","Bodega"]);
 const lineId=String(input.purchaseOrderLineId||"").trim(),materialId=String(input.materialId||"").trim();
 if(!lineId||!materialId)throw new Error("Selecciona una línea y un producto existente del Maestro.");
 const {data:line,error:le}=await supabase.from("purchase_order_lines").select("id,material_id,purchase_order_id,description").eq("id",lineId).single();
 if(le||!line)throw new Error("Línea de OC no encontrada.");
 if(line.material_id)throw new Error("Esta línea ya está vinculada a un producto.");
 const [{data:po,error:pe},{data:material,error:me}]=await Promise.all([
  supabase.from("purchase_orders").select("id,status").eq("id",line.purchase_order_id).single(),
  supabase.from("materials").select("id,name,active").eq("id",materialId).eq("active",true).single()
 ]);
 if(pe||!po||isClosedPurchaseOrder(po.status)||isCancelledPurchaseOrder(po.status))throw new Error("OC cerrada, anulada o inexistente.");
 if(me||!material)throw new Error("El producto debe existir y estar activo en el Maestro.");
 const {data:updated,error:ue}=await supabase.from("purchase_order_lines").update({material_id:materialId,line_type:"Material"}).eq("id",lineId).is("material_id",null).select("id").maybeSingle();
 if(ue||!updated)throw new Error(ue?.message||"No se pudo vincular el producto.");
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Recepción",action:"Vincular producto existente a OC",entity_table:"purchase_order_lines",entity_id:lineId,new_data:{material_id:materialId,material_name:material.name}});
 revalidatePath("/");
 return{ok:true,materialId,created:false};
}


export async function createAndResolvePurchaseOrderMaterial(input:{purchaseOrderLineId:string;name:string;family?:string;presentation?:string;unit?:string;supplierCode?:string}){
 const {supabase,user,profile}=await ctx(["Admin Total","Admin","Bodega"]);
 const lineId=String(input.purchaseOrderLineId||"").trim(),name=String(input.name||"").trim();
 if(!lineId||!name)throw new Error("Indica la línea y el nombre del producto");
 const {data:line,error:le}=await supabase.from("purchase_order_lines").select("id,purchase_order_id,material_id,line_type,description,unit,supplier_code,unit_net_price").eq("id",lineId).single();
 if(le||!line)throw new Error("Línea de compra no encontrada");
 if(line.material_id)throw new Error("Esta línea ya está vinculada a un producto");
 if(line.line_type==="Servicio")throw new Error("Un servicio no ingresa al inventario");
 const {data:po,error:pe}=await supabase.from("purchase_orders").select("id,status,order_number").eq("id",line.purchase_order_id).single();
 if(pe||!po||isClosedPurchaseOrder(po.status)||isCancelledPurchaseOrder(po.status))throw new Error("La orden de compra ya no admite catalogación");
 const supplierCode=String(input.supplierCode||line.supplier_code||"").trim()||null;
 const {data:catalog,error:ce}=await supabase.from("materials").select("id,name,presentation,unit,supplier_code,active");
 if(ce)throw ce;
 const norm=(v:unknown)=>String(v??"").trim().toLocaleLowerCase("es-CL").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
 const duplicate=(catalog||[]).find((m:any)=>supplierCode&&m.supplier_code&&norm(m.supplier_code)===norm(supplierCode)||(norm(m.name)===norm(name)&&norm(m.presentation)===norm(input.presentation||"")&&norm(m.unit)===norm(input.unit||line.unit||"UN")));
 if(duplicate)throw new Error("Ya existe un producto equivalente en el Maestro. Vincúlalo como producto existente para evitar duplicados.");
 const payload={family:String(input.family||"Por clasificar").trim()||"Por clasificar",name,presentation:String(input.presentation||"").trim()||null,unit:String(input.unit||line.unit||"UN").trim()||"UN",supplier_code:supplierCode,current_net_price:Number(line.unit_net_price||0),material_type:"Producto",active:true,price_review_required:true,price_source_note:"Creado desde "+String(po.order_number||"documento de compra")+"; validar valor con factura"};
 const {data:material,error:me}=await supabase.from("materials").insert(payload).select("id,name").single();if(me||!material)throw me||new Error("No se pudo crear el producto");
 const {error:ue}=await supabase.from("purchase_order_lines").update({material_id:material.id,line_type:"Material",description:material.name,unit:payload.unit,supplier_code:supplierCode}).eq("id",lineId).is("material_id",null);
 if(ue){await supabase.from("materials").update({active:false}).eq("id",material.id);throw ue}
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Recepción",action:"Crear producto desde compra y vincular",entity_table:"materials",entity_id:material.id,new_data:{...payload,purchase_order_line_id:lineId}});
 revalidatePath("/");return{ok:true,materialId:material.id,name:material.name};
}
