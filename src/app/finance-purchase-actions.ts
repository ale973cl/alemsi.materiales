"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

async function ctx(roles:string[]){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!profile?.active||!roles.includes(profile.role))throw new Error("No autorizado");
 return{supabase,user,profile};
}

export async function registerPurchaseWithoutOc(formData:FormData){
 const {supabase,user,profile}=await ctx(["Admin Total","Gerencia","Finanzas","Admin"]);
 const supplierId=String(formData.get("supplier_id")||"").trim();
 const documentType=String(formData.get("document_type")||"Factura").trim();
 const folio=String(formData.get("document_folio")||"").trim();
 const documentDate=String(formData.get("document_date")||"").trim();
 const net=Number(formData.get("document_net")||0),vat=Number(formData.get("document_vat")||0),total=Number(formData.get("document_total")||0);
 const reason=String(formData.get("no_oc_reason")||"").trim();
 const lines=JSON.parse(String(formData.get("lines")||"[]"));
 if(!supplierId)throw new Error("Selecciona proveedor");
 if(!folio)throw new Error("El folio es obligatorio");
 if(!documentDate)throw new Error("La fecha del documento es obligatoria");
 if(!reason)throw new Error("Debes indicar por qué la compra no tiene OC");
 if(!Array.isArray(lines)||!lines.some((l:any)=>l.material_id&&Number(l.received_qty)>0))throw new Error("Agrega al menos un material recibido");
 const {data:r,error}=await supabase.from("receipts").insert({purchase_order_id:null,supplier_id:supplierId,invoice_number:documentType==="Factura"?folio:null,invoice_date:documentDate,invoice_net:net,vat_amount:vat,status:"Pendiente cotejo",received_by:user.id,received_at:new Date().toISOString(),shipping_condition:"Incluido",freight_net:0,document_type:documentType,document_folio:folio,document_date:documentDate,document_net:net,document_total:total,no_oc_reason:reason,reconciliation_status:"Pendiente cotejo",inventory_posted:false}).select("id").single();
 if(error||!r)throw new Error(error?.message||"No se pudo registrar la compra");
 const rows=lines.filter((l:any)=>l.material_id&&Number(l.received_qty)>0).map((l:any)=>({receipt_id:r.id,purchase_order_line_id:null,material_id:l.material_id,received_qty:Number(l.received_qty),actual_unit_net:Number(l.actual_unit_net||0),line_net:Number(l.received_qty)*Number(l.actual_unit_net||0),difference_note:"Compra sin OC: "+reason}));
 const {error:le}=await supabase.from("receipt_lines").insert(rows);if(le){await supabase.from("receipts").delete().eq("id",r.id);throw new Error(le.message)}
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Finanzas",action:"Registrar compra sin OC",entity_table:"receipts",entity_id:r.id,new_data:{supplier_id:supplierId,document_type:documentType,folio,reason}});
 revalidatePath("/");return{ok:true,id:r.id};
}

export async function reconcilePurchaseDocument(formData:FormData){
 const {supabase,user,profile}=await ctx(["Admin Total","Gerencia","Finanzas"]);
 const receiptId=String(formData.get("receipt_id")||""),confirmation=String(formData.get("confirmation")||"");
 if(confirmation!=="CONFIRMAR")throw new Error("Confirma expresamente el cotejo antes de cargar inventario");
 const {data:r,error}=await supabase.from("receipts").select("id,purchase_order_id,document_folio,document_net,document_total,no_oc_reason,inventory_posted,receipt_lines(id,purchase_order_line_id,material_id,received_qty,actual_unit_net,line_net)").eq("id",receiptId).single();
 if(error||!r)throw new Error("Documento no encontrado");
 if(r.inventory_posted)throw new Error("Este documento ya fue cargado al inventario");

 let hasDifference=false;
 let purchaseOrder:any=null;
 if(r.purchase_order_id){
  const {data:po,error:poError}=await supabase.from("purchase_orders").select("id,total_net,status,purchase_order_lines(id,ordered_qty,unit_net_price)").eq("id",r.purchase_order_id).single();
  if(poError||!po)throw new Error("No se encontró la OC vinculada");
  purchaseOrder=po;
  const poLines=new Map((po.purchase_order_lines||[]).map((x:any)=>[String(x.id),x]));
  const receivedIds=new Set<string>();
  for(const line of (r as any).receipt_lines||[]){
   receivedIds.add(String(line.purchase_order_line_id||""));
   const src:any=poLines.get(String(line.purchase_order_line_id||""));
   if(!src||Number(src.ordered_qty)!==Number(line.received_qty)||Number(src.unit_net_price)!==Number(line.actual_unit_net))hasDifference=true;
  }
  if((po.purchase_order_lines||[]).some((x:any)=>!receivedIds.has(String(x.id))))hasDifference=true;
  if(Number(po.total_net||0)!==Number(r.document_net||0))hasDifference=true;
 }else if(!r.no_oc_reason)throw new Error("La compra sin OC requiere justificación");

 for(const line of (r as any).receipt_lines||[]){
  const {data:existingMove,error:existingError}=await supabase.from("inventory_movements").select("id").eq("receipt_line_id",line.id).limit(1);
  if(existingError)throw existingError;
  if((existingMove||[]).length)throw new Error("La recepción ya contiene movimientos de inventario. Revisa el cotejo antes de reintentar.");
  const [{data:material,error:materialError},{data:stockMoves,error:stockError}]=await Promise.all([
   supabase.from("materials").select("id,current_net_price").eq("id",line.material_id).single(),
   supabase.from("inventory_movements").select("signed_quantity").eq("material_id",line.material_id)
  ]);
  if(materialError||!material)throw new Error("Producto de la recepción no encontrado");
  if(stockError)throw stockError;
  const currentStock=(stockMoves||[]).reduce((sum:any,m:any)=>Number(sum)+Number(m.signed_quantity||0),0);
  const receivedQty=Number(line.received_qty||0),actualCost=Number(line.actual_unit_net||0),oldAvg=Number(material.current_net_price||0);
  const valuedStock=Math.max(0,currentStock),denominator=valuedStock+receivedQty;
  const weighted=denominator>0?((valuedStock*oldAvg)+(receivedQty*actualCost))/denominator:actualCost;
  const {error:moveError}=await supabase.from("inventory_movements").insert({material_id:line.material_id,receipt_line_id:line.id,movement_type:"receipt",quantity:receivedQty,signed_quantity:receivedQty,created_by:user.id,observation:"Documento "+String(r.document_folio||"sin folio")+" · costo neto factura "+actualCost});
  if(moveError)throw new Error(moveError.message);
  const {error:priceError}=await supabase.from("materials").update({current_net_price:Number(weighted.toFixed(4)),price_review_required:false,price_source_note:"Promedio ponderado actualizado con documento "+String(r.document_folio||"validado"),updated_at:new Date().toISOString()}).eq("id",line.material_id);
  if(priceError)throw priceError;
 }

 const receiptStatus=r.purchase_order_id?(hasDifference?"Con diferencia":"Conforme"):"Confirmada sin OC";
 const now=new Date().toISOString();
 const {error:updateError}=await supabase.from("receipts").update({reconciliation_status:receiptStatus,status:receiptStatus,inventory_posted:true,reconciled_by:user.id,reconciled_at:now}).eq("id",receiptId).eq("inventory_posted",false);
 if(updateError)throw new Error(updateError.message);

 let orderStatus:string|null=null,outstanding=0;
 if(r.purchase_order_id&&purchaseOrder){
  const receivedByLine=new Map<string,number>();
  for(const line of (r as any).receipt_lines||[])receivedByLine.set(String(line.purchase_order_line_id||""),Number(line.received_qty||0));
  outstanding=(purchaseOrder.purchase_order_lines||[]).reduce((sum:number,line:any)=>sum+Math.max(0,Number(line.ordered_qty||0)-Number(receivedByLine.get(String(line.id))||0)),0);
  orderStatus=outstanding>0?"Cerrada incompleta":"Cerrada";
  const {error:poUpdate}=await supabase.from("purchase_orders").update({status:orderStatus}).eq("id",r.purchase_order_id);
  if(poUpdate)throw new Error("Inventario cargado, pero no se pudo cerrar la OC: "+poUpdate.message);
 }

 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Finanzas",action:"Cotejar documento, cargar inventario y cerrar compra",entity_table:"receipts",entity_id:receiptId,new_data:{status:receiptStatus,inventory_posted:true,purchase_order_id:r.purchase_order_id||null,purchase_order_status:orderStatus,outstanding}});
 revalidatePath("/");
 return{ok:true,status:receiptStatus,purchaseOrderId:r.purchase_order_id||null,orderStatus,outstanding};
}
