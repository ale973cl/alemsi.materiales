"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {isClosedPurchaseOrder,isCancelledPurchaseOrder} from "@/lib/purchase-order-balance";

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
 const {data:po,error:poError}=await supabase.from("purchase_orders").select("id,supplier_id,status").eq("id",purchaseOrderId).single();if(poError||!po)throw new Error("OC no encontrada");
 if(isClosedPurchaseOrder(po.status)||isCancelledPurchaseOrder(po.status))throw new Error("Esta orden de compra está cerrada o anulada y no admite más recepciones");
 if(!Array.isArray(lines)||lines.length>500)throw new Error("Detalle de recepción inválido");
 const seen=new Set<string>();
 for(const item of lines){
   const key=String(item.purchase_order_line_id||"");
   if(!key||seen.has(key)||!Number.isFinite(Number(item.received_qty))||Number(item.received_qty)<=0||!Number.isFinite(Number(item.actual_unit_net))||Number(item.actual_unit_net)<0)throw new Error("Líneas duplicadas o cantidades/precios inválidos");
   seen.add(key);
 }
 // Validación en servidor: el cliente no puede exceder la OC ni recibir productos ajenos.
 const {data:poLines,error:polError}=await supabase.from("purchase_order_lines").select("id,material_id,ordered_qty").eq("purchase_order_id",purchaseOrderId);
 if(polError)throw new Error(polError.message);
 const masterLines=new Map((poLines||[]).map((l:any)=>[String(l.id),l]));
 const {data:previousReceipts,error:previousError}=await supabase.from("receipts").select("id,supplier_id,document_type,document_folio,receipt_lines(purchase_order_line_id,received_qty)").eq("purchase_order_id",purchaseOrderId);
 if(previousError)throw new Error(previousError.message);
 if((previousReceipts||[]).some((r:any)=>String(r.document_type||"")===documentType&&String(r.document_folio||"").trim().toLowerCase()===documentFolio.toLowerCase()))throw new Error("Este folio ya está vinculado a la OC");
 const previous=new Map<string,number>();
 for(const r of previousReceipts||[])for(const l of (r as any).receipt_lines||[]){const key=String(l.purchase_order_line_id||"");previous.set(key,(previous.get(key)||0)+Number(l.received_qty||0))}
 for(const item of lines){
   const record:any=masterLines.get(String(item.purchase_order_line_id));
   if(!record||!record.material_id||String(record.material_id)!==String(item.material_id))throw new Error("La recepción contiene un material no vinculado a esta OC");
   const remaining=Math.max(0,Number(record.ordered_qty||0)-(previous.get(String(record.id))||0));
   if(Number(item.received_qty)>remaining)throw new Error("Se intentó recibir más cantidad que el saldo vigente de la OC");
 }
 const {data:duplicateDocument,error:duplicateError}=await supabase.from("receipts").select("id").eq("supplier_id",po.supplier_id).eq("document_type",documentType).eq("document_folio",documentFolio).limit(1);
 if(duplicateError)throw new Error(duplicateError.message);
 if((duplicateDocument||[]).length)throw new Error("Este folio ya fue registrado para el mismo proveedor");

 const {data:receipt,error}=await supabase.from("receipts").insert({purchase_order_id:purchaseOrderId,supplier_id:po.supplier_id,invoice_number:documentType==="Factura"?documentFolio:null,invoice_date:documentDate,invoice_net:documentNet,vat_amount:documentVat,status:"Pendiente cotejo",received_by:user.id,received_at:new Date().toISOString(),shipping_condition:shippingCondition,freight_net:shippingCondition==="Por pagar"?freightNet:0,document_type:documentType,document_folio:documentFolio,document_date:documentDate,document_net:documentNet,document_total:documentTotal,reconciliation_status:"Pendiente cotejo",inventory_posted:false}).select("id").single();
 if(error||!receipt)throw new Error(error?.message||"No se pudo registrar el documento");
 const lineRows=lines.filter((l:any)=>Number(l.received_qty)>0).map((l:any)=>({receipt_id:receipt.id,purchase_order_line_id:l.purchase_order_line_id,material_id:l.material_id,received_qty:Number(l.received_qty),actual_unit_net:Number(l.actual_unit_net||0),line_net:Number(l.received_qty)*Number(l.actual_unit_net||0),difference_note:null}));
 const {error:lineError}=await supabase.from("receipt_lines").insert(lineRows);if(lineError){await supabase.from("receipts").delete().eq("id",receipt.id);throw new Error(lineError.message);}
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Recepción",action:"Registrar documento para cotejo",entity_table:"receipts",entity_id:receipt.id,new_data:{purchase_order_id:purchaseOrderId,document_type:documentType,document_folio:documentFolio,document_date:documentDate,document_net:documentNet,document_total:documentTotal},observation});
 revalidatePath("/");return{ok:true,id:receipt.id};
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

export async function resolvePurchaseOrderMaterial(input:{purchaseOrderLineId:string;name:string;unit:string;family:string;presentation?:string;unitNet:number}){
 const {supabase,user,profile}=await ctx(["Admin Total","Admin","Bodega"]);
 const lineId=String(input.purchaseOrderLineId||"").trim();
 const name=String(input.name||"").trim();
 const unit=String(input.unit||"").trim()||"UN";
 const family=String(input.family||"").trim()||"Otros";
 const price=Number(input.unitNet||0);
 if(!lineId||!name)throw new Error("Línea y nombre del producto obligatorios");
 if(!Number.isFinite(price)||price<0)throw new Error("Precio neto inválido");
 const {data:line,error:le}=await supabase.from("purchase_order_lines").select("id,material_id,purchase_order_id,description,supplier_code").eq("id",lineId).single();
 if(le||!line)throw new Error("No existe la línea de OC");
 if(line.material_id)throw new Error("La línea ya tiene un producto del maestro");
 const {data:po,error:pe}=await supabase.from("purchase_orders").select("id,status").eq("id",line.purchase_order_id).single();
 if(pe||!po||isClosedPurchaseOrder(po.status)||isCancelledPurchaseOrder(po.status))throw new Error("La orden está cerrada o no existe");
 const normalized=(v:string)=>v.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-CL");
 const {data:existing,error:ee}=await supabase.from("materials").select("id,name,unit,active").eq("active",true);
 if(ee)throw new Error(ee.message);
 const duplicate=(existing||[]).find((m:any)=>normalized(String(m.name||""))===normalized(name)&&normalized(String(m.unit||""))===normalized(unit));
 let materialId=String(duplicate?.id||"");let createdId="";
 if(!materialId){
  const {data, error}=await supabase.from("materials").insert({name,family,unit,presentation:String(input.presentation||"").trim()||null,supplier_code:line.supplier_code||null,current_net_price:price,active:true,price_source_note:"Alta durante recepción manual de OC"}).select("id").single();
  if(error||!data)throw new Error(error?.message||"No se pudo crear el material");
  materialId=data.id;createdId=data.id;
 }
 const {error:updateError}=await supabase.from("purchase_order_lines").update({material_id:materialId}).eq("id",lineId).is("material_id",null);
 if(updateError){
  if(createdId)await supabase.from("materials").delete().eq("id",createdId);
  throw new Error(updateError.message);
 }
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Recepción",action:createdId?"Crear y vincular material de OC":"Vincular material existente a OC",entity_table:"purchase_order_lines",entity_id:lineId,new_data:{material_id:materialId,material_name:name,created:!!createdId}});
 revalidatePath("/");
 return{ok:true,materialId,created:!!createdId};
}
