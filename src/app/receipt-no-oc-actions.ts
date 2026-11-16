"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

type MaterialLine={material_id:string;received_qty:number;actual_unit_net:number};
const number=(x:unknown)=>Number(x);
export async function registerReceiptWithoutOrder(formData:FormData){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Admin","Bodega"].includes(profile.role))throw new Error("No autorizado para recibir materiales");
 const supplierId=String(formData.get("supplier_id")||"");
 const documentType=String(formData.get("document_type")||"Factura");
 const folio=String(formData.get("document_folio")||"").trim();
 const date=String(formData.get("document_date")||"");
 const reason=String(formData.get("no_oc_reason")||"").trim();
 const net=number(formData.get("document_net")),vat=number(formData.get("document_vat")),total=number(formData.get("document_total"));
 const shipping=String(formData.get("shipping_condition")||"Incluido");
 const freight=number(formData.get("freight_net")||0);
 const paymentCondition=String(formData.get("payment_condition")||"Sin confirmar");
 const paymentDays=number(formData.get("payment_days")||0);
 const paymentDue=String(formData.get("payment_due")||"");
 const notes=String(formData.get("observation")||"").trim();
 let lines:MaterialLine[];
 try{lines=JSON.parse(String(formData.get("lines")||"[]"));}catch{throw new Error("Productos recibidos inválidos");}
 if(!supplierId||!folio||!/^\d{4}-\d{2}-\d{2}$/.test(date)||reason.length<8)throw new Error("Proveedor, folio, fecha y justificación sin OC (8 caracteres mínimo) son obligatorios");
 if(!["Factura","Boleta","Guía de despacho","Otro"].includes(documentType))throw new Error("Tipo de documento inválido");
 if(!["Incluido","Por pagar","Retiro"].includes(shipping)||shipping==="Por pagar"&&!(freight>0))throw new Error("Revisa la condición y costo del flete");
 if(!["Contado","Crédito","Sin confirmar"].includes(paymentCondition)||paymentDays<0||paymentDays>365||!Number.isInteger(paymentDays))throw new Error("Condición de pago inválida");
 if(!Array.isArray(lines)||!lines.length||lines.length>150)throw new Error("Agrega al menos un producto");
 if(![net,vat,total,freight].every(x=>Number.isFinite(x)&&x>=0))throw new Error("Importes inválidos");
 if(Math.abs(net+vat-total)>1)throw new Error("Neto + IVA no coincide con el total del documento");
 const ids=new Set<string>();
 for(const l of lines){
  if(!l.material_id||ids.has(l.material_id)||!Number.isFinite(l.received_qty)||l.received_qty<=0||!Number.isFinite(l.actual_unit_net)||l.actual_unit_net<0)throw new Error("Producto duplicado, cantidad o precio inválido");
  ids.add(l.material_id);
 }
 const [{data:supplier,error:supplierError},{data:materials,error:materialError},{data:duplicates,error:dupError}]=await Promise.all([
  supabase.from("suppliers").select("id,legal_name,rut").eq("id",supplierId).eq("active",true).single(),
  supabase.from("materials").select("id").in("id",[...ids]).eq("active",true),
  supabase.from("receipts").select("id").eq("supplier_id",supplierId).eq("document_type",documentType).eq("document_folio",folio).limit(1),
 ]);
 if(supplierError||!supplier)throw new Error("Proveedor no válido");
 if(materialError||(materials||[]).length!==ids.size)throw new Error("Selecciona productos activos del Maestro ALEMSI");
 if(dupError||(duplicates||[]).length)throw new Error("Este proveedor ya tiene registrado el folio indicado");
 const rows=lines.map(l=>({material_id:l.material_id,received_qty:l.received_qty,actual_unit_net:l.actual_unit_net,line_net:l.received_qty*l.actual_unit_net,purchase_order_line_id:null as null}));
 const linesNet=rows.reduce((sum,l)=>sum+l.line_net,0);
 if(Math.abs(linesNet-net)>1)throw new Error("El neto de las líneas no coincide con el neto de la factura. Corrige antes de guardar");
 const {data:receipt,error}=await supabase.from("receipts").insert({
  purchase_order_id:null,supplier_id:supplierId,invoice_number:documentType==="Factura"?folio:null,invoice_date:date,invoice_net:net,vat_amount:vat,
  document_type:documentType,document_folio:folio,document_date:date,document_net:net,document_total:total,
  status:"Pendiente cotejo",reconciliation_status:"Pendiente cotejo",inventory_posted:false,received_by:user.id,received_at:new Date().toISOString(),
  no_oc_reason:reason,shipping_condition:shipping,freight_net:shipping==="Por pagar"?freight:0,
 }).select("id").single();
 if(error||!receipt)throw new Error(error?.message||"No se pudo registrar la recepción");
 const {error:lineError}=await supabase.from("receipt_lines").insert(rows.map(({purchase_order_line_id,...line})=>({...line,receipt_id:receipt.id,purchase_order_line_id})));
 if(lineError){await supabase.from("receipts").delete().eq("id",receipt.id);throw new Error(lineError.message);}
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Recepción",action:"Recepción sin OC pendiente de cotejo",entity_table:"receipts",entity_id:receipt.id,new_data:{
  supplier:supplier.legal_name,rut:supplier.rut,document_type:documentType,document_folio:folio,payment_condition:paymentCondition,payment_days:paymentDays,payment_due:paymentDue||null,payment_status:"Sin confirmar",observation:notes,lines:rows.length
 }});
 revalidatePath("/");
 return{ok:true,id:receipt.id,inventory_updated:false};
}
