"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {committedPurchaseQty} from "@/lib/purchase-order-balance";

type Selection={material_id:string;qty:number;unit_net_price:number};
type FreeLine={line_type?:"Material"|"Producto nuevo"|"Servicio";material_id?:string|null;description:string;qty:number;unit:string;unit_net_price:number;supplier_code?:string};

async function supplyContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role))throw new Error("No autorizado para generar órdenes de compra");
  return{supabase,user,profile};
}

const totals=(net:number,vatRate=19)=>{const vat=Math.round(net*vatRate/100);return{net,vat,total:net+vat,vatRate}};
const folioFromId=(id:string,prefix="OC")=>`${prefix}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${id.slice(0,6).toUpperCase()}`;

export async function createPurchaseOrderFromConsolidated(formData:FormData){
  const {supabase,user,profile}=await supplyContext();
  const campaignId=String(formData.get("campaign_id")||"");
  const supplierId=String(formData.get("supplier_id")||"");
  const documentKind=String(formData.get("document_kind")||"Orden de compra")==="Cotización"?"Cotización":"Orden de compra";
  const selections=JSON.parse(String(formData.get("selections")||"[]")) as Selection[];
  if(!campaignId||!supplierId)throw new Error("Selecciona campaña y proveedor");
  const chosen=selections.map(item=>({material_id:String(item.material_id),qty:Number(item.qty||0),unit_net_price:Number(item.unit_net_price||0)})).filter(item=>item.qty>0);
  if(!chosen.length)throw new Error("Ingresa al menos una cantidad para el documento");
  if(chosen.some(item=>item.qty<0||item.unit_net_price<0))throw new Error("Cantidades y precios deben ser válidos");

  const [{data:campaign,error:campaignError},{data:supplier,error:supplierError}]=await Promise.all([
    supabase.from("campaigns").select("id,contract_id,label,status").eq("id",campaignId).single(),
    supabase.from("suppliers").select("id,legal_name,active").eq("id",supplierId).eq("active",true).single()
  ]);
  if(campaignError||!campaign)throw new Error("Campaña no encontrada");
  if(supplierError||!supplier)throw new Error("Proveedor no disponible");

  const {data:surveys,error:surveyError}=await supabase.from("surveys").select("id,installation_id,survey_lines(id,material_id,shortage_qty,unit_net_price,line_net)").eq("campaign_id",campaignId).eq("status","Confirmada").not("confirmed_at","is",null);
  if(surveyError)throw surveyError;
  const required=new Map<string,{qty:number;unit_net_price:number;allocations:{survey_line_id:string;installation_id:string;qty:number}[]}>();
  for(const survey of surveys||[]){for(const line of (survey as any).survey_lines||[]){const qty=Number(line.shortage_qty||0);if(qty<=0)continue;const current=required.get(line.material_id)||{qty:0,unit_net_price:Number(line.unit_net_price||0),allocations:[]};current.qty+=qty;if(!current.unit_net_price)current.unit_net_price=Number(line.unit_net_price||0);current.allocations.push({survey_line_id:line.id,installation_id:survey.installation_id,qty});required.set(line.material_id,current)}}
  if(!required.size)throw new Error("La campaña no tiene cantidades confirmadas para pedir");

  const {data:runs}=await supabase.from("supply_runs").select("id,campaign_id,contract_id").eq("campaign_id",campaignId).order("created_at",{ascending:true});
  let run=(runs||[])[0] as any;
  if(!run){
    // Las campañas multicontrato no tienen contrato base: el costo se imputa por guía de entrega.
    const consolidatedNet=[...required.values()].reduce((sum,item)=>sum+item.qty*item.unit_net_price,0);
    const created=await supabase.from("supply_runs").insert({campaign_id:campaignId,contract_id:campaign.contract_id,status:"En abastecimiento",consolidated_net:consolidatedNet,approved_net:0}).select("id,campaign_id,contract_id").single();
    if(created.error||!created.data)throw created.error||new Error("No se pudo crear el abastecimiento");
    run=created.data;
  }

  const allRunIds=(runs||[]).map((item:any)=>item.id);if(!allRunIds.includes(run.id))allRunIds.push(run.id);
  const {data:existingOrders}=await supabase.from("purchase_orders").select("id,status").in("supply_run_id",allRunIds);
  const orderIds=(existingOrders||[]).map((item:any)=>item.id);
  const orderedByMaterial=new Map<string,number>();
  if(orderIds.length){
    const [{data:oldLines,error:oldLinesError},{data:postedReceipts,error:receiptError}]=await Promise.all([
      supabase.from("purchase_order_lines").select("id,purchase_order_id,material_id,ordered_qty").in("purchase_order_id",orderIds),
      supabase.from("receipts").select("purchase_order_id,receipt_lines(purchase_order_line_id,received_qty)").in("purchase_order_id",orderIds).eq("inventory_posted",true)
    ]);
    if(oldLinesError)throw oldLinesError;if(receiptError)throw receiptError;
    const posted=new Map<string,number>();
    for(const receipt of postedReceipts||[])for(const line of (receipt as any).receipt_lines||[]){
      const id=String(line.purchase_order_line_id||"");posted.set(id,(posted.get(id)||0)+Number(line.received_qty||0));
    }
    const status=new Map((existingOrders||[]).map((o:any)=>[String(o.id),String(o.status||"")]));
    for(const line of oldLines||[])if(line.material_id){
      const qty=committedPurchaseQty(status.get(String(line.purchase_order_id)),line.ordered_qty,posted.get(String(line.id)));
      orderedByMaterial.set(line.material_id,Number(orderedByMaterial.get(line.material_id)||0)+qty);
    }
  }

  for(const item of chosen){const source=required.get(item.material_id);if(!source)throw new Error("Uno de los productos ya no tiene necesidad confirmada");const pending=Math.max(source.qty-Number(orderedByMaterial.get(item.material_id)||0),0);if(item.qty>pending)throw new Error(`La cantidad seleccionada supera el saldo pendiente (${pending})`)}

  const {data:runLines,error:runLinesError}=await supabase.from("supply_lines").select("id,material_id,required_qty").eq("supply_run_id",run.id);
  if(runLinesError)throw runLinesError;
  const lineByMaterial=new Map<string,any>((runLines||[]).map((line:any)=>[line.material_id,line]));
  for(const [materialId,source] of required){let supplyLine=lineByMaterial.get(materialId);if(!supplyLine){const created=await supabase.from("supply_lines").insert({supply_run_id:run.id,material_id:materialId,required_qty:source.qty,approved_qty:0,estimated_unit_net:source.unit_net_price,approved_net:0}).select("id,material_id,required_qty").single();if(created.error||!created.data)throw created.error||new Error("No se pudo crear línea de abastecimiento");supplyLine=created.data;lineByMaterial.set(materialId,supplyLine)}else{const updated=await supabase.from("supply_lines").update({required_qty:source.qty,estimated_unit_net:source.unit_net_price}).eq("id",supplyLine.id);if(updated.error)throw updated.error}
    const clear=await supabase.from("supply_allocations").delete().eq("supply_line_id",supplyLine.id);if(clear.error)throw clear.error;
    if(source.allocations.length){const alloc=await supabase.from("supply_allocations").insert(source.allocations.map(item=>({supply_line_id:supplyLine.id,survey_line_id:item.survey_line_id,installation_id:item.installation_id,allocated_qty:item.qty})));if(alloc.error)throw alloc.error}
  }

  // Registrar el proveedor definitivo de las líneas que originan este documento.
  // Una campaña puede generar órdenes para distintos proveedores.
  for(const item of chosen){
    const supplyLine=lineByMaterial.get(item.material_id);
    if(!supplyLine)throw new Error("Línea de abastecimiento no encontrada");
    const {error:assignError}=await supabase.from("supply_lines").update({final_supplier_id:supplierId}).eq("id",supplyLine.id);
    if(assignError)throw assignError;
  }

  const t=totals(chosen.reduce((sum,item)=>sum+item.qty*item.unit_net_price,0));
  const isQuote=documentKind==="Cotización";
  const createdOrder=await supabase.from("purchase_orders").insert({supply_run_id:run.id,supplier_id:supplierId,order_type:isQuote?"Cotización":"Abastecimiento",status:isQuote?"Solicitud de cotización":"Borrador",total_net:t.net,vat_rate:t.vatRate,vat_amount:t.vat,total_amount:t.total,currency:"CLP"}).select("id").single();
  if(createdOrder.error||!createdOrder.data)throw createdOrder.error||new Error("No se pudo crear el documento");
  const orderId=createdOrder.data.id;
  const folio=folioFromId(orderId,isQuote?"COT":"OC");
  const updateFolio=await supabase.from("purchase_orders").update({order_number:folio}).eq("id",orderId);if(updateFolio.error)throw updateFolio.error;
  const poLines=chosen.map(item=>({purchase_order_id:orderId,supply_line_id:lineByMaterial.get(item.material_id)?.id||null,material_id:item.material_id,line_type:"Material",ordered_qty:item.qty,unit_net_price:item.unit_net_price,line_net:item.qty*item.unit_net_price}));
  const insertedLines=await supabase.from("purchase_order_lines").insert(poLines);if(insertedLines.error)throw insertedLines.error;

  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Compras",action:isQuote?"Crear cotización desde consolidado":"Crear OC desde consolidado",entity_table:"purchase_orders",entity_id:orderId,new_data:{campaign_id:campaignId,supplier_id:supplierId,supplier:supplier.legal_name,order_number:folio,total_net:t.net,vat_amount:t.vat,total_amount:t.total,lines:poLines},observation:isQuote?"Solicitud de cotización vinculada a la necesidad; no reserva demanda hasta convertirse en OC.":"OC vinculada a carencias confirmadas y asignaciones por instalación."});
  revalidatePath("/");
  return{ok:true,id:orderId,order_number:folio,total_net:t.net,total_amount:t.total,document_kind:documentKind};
}

export async function createFreePurchaseOrder(formData:FormData){
  const {supabase,user,profile}=await supplyContext();
  const supplierId=String(formData.get("supplier_id")||"").trim();
  const documentKind=String(formData.get("document_kind")||"Orden de compra")==="Cotización"?"Cotización":"Orden de compra";
  if(!supplierId)throw new Error("Selecciona un proveedor");
  const rawLines=JSON.parse(String(formData.get("lines")||"[]")) as FreeLine[];
  if(!Array.isArray(rawLines)||!rawLines.length||rawLines.length>200)throw new Error("Agrega entre 1 y 200 líneas");
  const lines=rawLines.map(line=>({
    line_type:line.line_type==="Servicio"?"Servicio":line.line_type==="Producto nuevo"?"Producto nuevo":"Material",
    material_id:String(line.material_id||"").trim()||null,
    description:String(line.description||"").trim(),
    qty:Number(line.qty||0),unit:String(line.unit||"").trim()||"UN",
    unit_net_price:Number(line.unit_net_price||0),supplier_code:String(line.supplier_code||"").trim()||null
  })).filter(line=>line.qty>0||line.description||line.material_id);
  if(!lines.length)throw new Error("Agrega al menos un producto o servicio");
  if(lines.some(line=>!Number.isFinite(line.qty)||line.qty<=0||!Number.isFinite(line.unit_net_price)||line.unit_net_price<0))throw new Error("Revisa cantidades y precios");
  if(lines.some(line=>line.line_type==="Material"&&!line.material_id))throw new Error("Selecciona el producto existente o cámbialo a Producto nuevo");
  if(lines.some(line=>(line.line_type==="Producto nuevo"||line.line_type==="Servicio")&&!line.description))throw new Error("Describe los productos nuevos y servicios");
  const ids=[...new Set(lines.filter(line=>line.line_type==="Material").map(line=>line.material_id!))];
  const {data:master,error:masterError}=ids.length?await supabase.from("materials").select("id,name,unit,supplier_code,active").in("id",ids).eq("active",true):{data:[],error:null};
  if(masterError||(master||[]).length!==ids.length)throw new Error("Uno o más productos del Maestro no existen o están inactivos");
  const materialById=new Map((master||[]).map(item=>[item.id,item]));
  const finalized=lines.map(line=>{
    if(line.line_type!=="Material")return{...line,material_id:null};
    const product=materialById.get(line.material_id!);
    if(!product)throw new Error("Producto no encontrado");
    return{...line,description:product.name,unit:product.unit||"UN",supplier_code:product.supplier_code||null,material_id:product.id};
  });
  const {data:supplier,error:supplierError}=await supabase.from("suppliers").select("id,legal_name,rut,address,payment_terms,conditions,active").eq("id",supplierId).eq("active",true).single();
  if(supplierError||!supplier)throw new Error("Proveedor no disponible");
  const paymentTerms=String(formData.get("payment_terms")||supplier.payment_terms||"").trim()||null;
  const deliveryTerms=String(formData.get("delivery_terms")||"").trim()||null;
  const billingAddress=String(formData.get("billing_address")||"").trim()||null;
  const deliveryAddress=String(formData.get("delivery_address")||"").trim()||null;
  const conditions=String(formData.get("conditions")||supplier.conditions||"").trim()||null;
  const observations=String(formData.get("observations")||"").trim()||null;
  const vatRate=Math.max(0,Number(formData.get("vat_rate")||19));
  const t=totals(finalized.reduce((sum,line)=>sum+line.qty*line.unit_net_price,0),vatRate);
  const isQuote=documentKind==="Cotización";
  const created=await supabase.from("purchase_orders").insert({supply_run_id:null,supplier_id:supplierId,order_type:isQuote?"Cotización":"Libre",status:isQuote?"Solicitud de cotización":"Borrador",total_net:t.net,vat_rate:t.vatRate,vat_amount:t.vat,total_amount:t.total,currency:"CLP",payment_terms:paymentTerms,delivery_terms:deliveryTerms,billing_address:billingAddress,delivery_address:deliveryAddress,conditions,observations}).select("id").single();
  if(created.error||!created.data)throw created.error||new Error("No se pudo crear el documento");
  const orderId=created.data.id;
  const folio=folioFromId(orderId,isQuote?"COT":"OC");
  const folioUpdate=await supabase.from("purchase_orders").update({order_number:folio}).eq("id",orderId);if(folioUpdate.error)throw folioUpdate.error;
  const inserted=await supabase.from("purchase_order_lines").insert(finalized.map(line=>({purchase_order_id:orderId,supply_line_id:null,material_id:line.material_id,line_type:line.line_type,description:line.description,unit:line.unit,supplier_code:line.supplier_code,ordered_qty:line.qty,unit_net_price:line.unit_net_price,line_net:line.qty*line.unit_net_price})));
  if(inserted.error){await supabase.from("purchase_orders").delete().eq("id",orderId);throw inserted.error;}
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Compras",action:isQuote?"Crear solicitud de cotización":"Crear OC libre",entity_table:"purchase_orders",entity_id:orderId,new_data:{order_number:folio,supplier_id:supplierId,supplier:supplier.legal_name,total_net:t.net,total_amount:t.total,lines:finalized},observation:isQuote?"Documento de cotización creado desde el mismo motor de compras.":"OC administrativa creada sin campaña ni abastecimiento."});
  revalidatePath("/");
  return{ok:true,id:orderId,order_number:folio,total_net:t.net,total_amount:t.total,document_kind:documentKind};
}

export async function updateQuotationResponse(formData:FormData){
  const {supabase,user,profile}=await supplyContext();
  const quoteId=String(formData.get("quote_id")||"").trim();
  const lines=JSON.parse(String(formData.get("lines")||"[]")) as {id:string;qty:number;unit_net_price:number;supplier_code?:string}[];
  if(!quoteId||!Array.isArray(lines)||!lines.length)throw new Error("Cotización inválida");
  const {data:quote,error:qError}=await supabase.from("purchase_orders").select("id,order_number,order_type,status,vat_rate,purchase_order_lines(id,ordered_qty,unit_net_price)").eq("id",quoteId).single();
  if(qError||!quote||quote.order_type!=="Cotización")throw new Error("Cotización no encontrada");
  if(/convertid|anulad|cancelad/i.test(String(quote.status||"")))throw new Error("La cotización ya no admite cambios");
  const current=new Map((quote.purchase_order_lines||[]).map((l:any)=>[String(l.id),l]));
  let net=0;
  for(const item of lines){
    const src:any=current.get(String(item.id));if(!src)throw new Error("Línea de cotización no encontrada");
    const qty=Number(item.qty),price=Number(item.unit_net_price);
    if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(price)||price<0)throw new Error("Revisa cantidades y precios");
    const {error}=await supabase.from("purchase_order_lines").update({ordered_qty:qty,unit_net_price:price,line_net:qty*price,supplier_code:String(item.supplier_code||"").trim()||null}).eq("id",item.id).eq("purchase_order_id",quoteId);
    if(error)throw error;net+=qty*price;
  }
  const t=totals(net,Number(quote.vat_rate||19));
  const {error:updateError}=await supabase.from("purchase_orders").update({status:"Cotización recibida",total_net:t.net,vat_amount:t.vat,total_amount:t.total,payment_terms:String(formData.get("payment_terms")||"").trim()||null,delivery_terms:String(formData.get("delivery_terms")||"").trim()||null,conditions:String(formData.get("conditions")||"").trim()||null}).eq("id",quoteId);
  if(updateError)throw updateError;
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Compras",action:"Registrar respuesta de cotización",entity_table:"purchase_orders",entity_id:quoteId,new_data:{status:"Cotización recibida",total_net:t.net,total_amount:t.total}});
  revalidatePath("/");return{ok:true,id:quoteId,status:"Cotización recibida",total_net:t.net,total_amount:t.total};
}

export async function convertQuotationToPurchaseOrder(formData:FormData){
  const {supabase,user,profile}=await supplyContext();
  const quoteId=String(formData.get("quote_id")||"").trim();
  const {data:quote,error}=await supabase.from("purchase_orders").select("*,purchase_order_lines(*)").eq("id",quoteId).single();
  if(error||!quote||quote.order_type!=="Cotización")throw new Error("Cotización no encontrada");
  if(/convertid|anulad|cancelad/i.test(String(quote.status||"")))throw new Error("Esta cotización ya fue cerrada");
  const lines=(quote.purchase_order_lines||[]) as any[];if(!lines.length)throw new Error("Cotización sin líneas");
  const origin="Origen: "+(quote.order_number||"cotización");
  const created=await supabase.from("purchase_orders").insert({supply_run_id:quote.supply_run_id,supplier_id:quote.supplier_id,order_type:quote.supply_run_id?"Abastecimiento":"Libre",status:"Borrador",total_net:quote.total_net,vat_rate:quote.vat_rate,vat_amount:quote.vat_amount,total_amount:quote.total_amount,currency:quote.currency||"CLP",payment_terms:quote.payment_terms,delivery_terms:quote.delivery_terms,billing_address:quote.billing_address,delivery_address:quote.delivery_address,conditions:quote.conditions,observations:[quote.observations,origin].filter(Boolean).join(" · ")}).select("id").single();
  if(created.error||!created.data)throw created.error||new Error("No se pudo convertir la cotización");
  const orderId=created.data.id,folio=folioFromId(orderId,"OC");
  const {error:folioError}=await supabase.from("purchase_orders").update({order_number:folio}).eq("id",orderId);if(folioError)throw folioError;
  const {error:lineError}=await supabase.from("purchase_order_lines").insert(lines.map(line=>({purchase_order_id:orderId,supply_line_id:line.supply_line_id,material_id:line.material_id,line_type:line.line_type,description:line.description,unit:line.unit,supplier_code:line.supplier_code,ordered_qty:line.ordered_qty,unit_net_price:line.unit_net_price,line_net:line.line_net})));
  if(lineError){await supabase.from("purchase_orders").delete().eq("id",orderId);throw lineError}
  const {error:quoteUpdate}=await supabase.from("purchase_orders").update({status:"Convertida a OC"}).eq("id",quoteId);if(quoteUpdate)throw quoteUpdate;
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Compras",action:"Convertir cotización en OC",entity_table:"purchase_orders",entity_id:orderId,new_data:{quote_id:quoteId,quote_number:quote.order_number,order_number:folio}});
  revalidatePath("/");return{ok:true,id:orderId,order_number:folio,quote_id:quoteId};
}

