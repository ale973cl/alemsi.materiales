"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

type Selection={material_id:string;qty:number;unit_net_price:number};

async function supplyContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role))throw new Error("No autorizado para generar órdenes de compra");
  return{supabase,user,profile};
}

export async function createPurchaseOrderFromConsolidated(formData:FormData){
  const {supabase,user,profile}=await supplyContext();
  const campaignId=String(formData.get("campaign_id")||"");
  const supplierId=String(formData.get("supplier_id")||"");
  const selections=JSON.parse(String(formData.get("selections")||"[]")) as Selection[];
  if(!campaignId||!supplierId)throw new Error("Selecciona campaña y proveedor");
  const chosen=selections.map(item=>({material_id:String(item.material_id),qty:Number(item.qty||0),unit_net_price:Number(item.unit_net_price||0)})).filter(item=>item.qty>0);
  if(!chosen.length)throw new Error("Ingresa al menos una cantidad para la OC");
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
    if(!campaign.contract_id)throw new Error("La campaña no tiene contrato base para iniciar abastecimiento");
    const consolidatedNet=[...required.values()].reduce((sum,item)=>sum+item.qty*item.unit_net_price,0);
    const created=await supabase.from("supply_runs").insert({campaign_id:campaignId,contract_id:campaign.contract_id,status:"En abastecimiento",consolidated_net:consolidatedNet,approved_net:0}).select("id,campaign_id,contract_id").single();
    if(created.error||!created.data)throw created.error||new Error("No se pudo crear el abastecimiento");
    run=created.data;
  }

  const allRunIds=(runs||[]).map((item:any)=>item.id);if(!allRunIds.includes(run.id))allRunIds.push(run.id);
  const {data:existingOrders}=await supabase.from("purchase_orders").select("id").in("supply_run_id",allRunIds);
  const orderIds=(existingOrders||[]).map((item:any)=>item.id);
  const orderedByMaterial=new Map<string,number>();
  if(orderIds.length){const {data:oldLines,error:oldLinesError}=await supabase.from("purchase_order_lines").select("material_id,ordered_qty").in("purchase_order_id",orderIds);if(oldLinesError)throw oldLinesError;for(const line of oldLines||[])orderedByMaterial.set(line.material_id,Number(orderedByMaterial.get(line.material_id)||0)+Number(line.ordered_qty||0))}

  for(const item of chosen){const source=required.get(item.material_id);if(!source)throw new Error("Uno de los productos ya no tiene necesidad confirmada");const pending=Math.max(source.qty-Number(orderedByMaterial.get(item.material_id)||0),0);if(item.qty>pending)throw new Error(`La cantidad seleccionada supera el saldo pendiente (${pending})`)}

  const {data:runLines,error:runLinesError}=await supabase.from("supply_lines").select("id,material_id,required_qty").eq("supply_run_id",run.id);
  if(runLinesError)throw runLinesError;
  const lineByMaterial=new Map<string,any>((runLines||[]).map((line:any)=>[line.material_id,line]));
  for(const [materialId,source] of required){let supplyLine=lineByMaterial.get(materialId);if(!supplyLine){const created=await supabase.from("supply_lines").insert({supply_run_id:run.id,material_id:materialId,required_qty:source.qty,approved_qty:0,estimated_unit_net:source.unit_net_price,approved_net:0}).select("id,material_id,required_qty").single();if(created.error||!created.data)throw created.error||new Error("No se pudo crear línea de abastecimiento");supplyLine=created.data;lineByMaterial.set(materialId,supplyLine)}else{const updated=await supabase.from("supply_lines").update({required_qty:source.qty,estimated_unit_net:source.unit_net_price}).eq("id",supplyLine.id);if(updated.error)throw updated.error}
    const clear=await supabase.from("supply_allocations").delete().eq("supply_line_id",supplyLine.id);if(clear.error)throw clear.error;
    if(source.allocations.length){const alloc=await supabase.from("supply_allocations").insert(source.allocations.map(item=>({supply_line_id:supplyLine.id,survey_line_id:item.survey_line_id,installation_id:item.installation_id,allocated_qty:item.qty})));if(alloc.error)throw alloc.error}
  }

  const totalNet=chosen.reduce((sum,item)=>sum+item.qty*item.unit_net_price,0);
  const createdOrder=await supabase.from("purchase_orders").insert({supply_run_id:run.id,supplier_id:supplierId,status:"Borrador",total_net:totalNet}).select("id").single();
  if(createdOrder.error||!createdOrder.data)throw createdOrder.error||new Error("No se pudo crear la orden de compra");
  const orderId=createdOrder.data.id;
  const folio=`OC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${orderId.slice(0,6).toUpperCase()}`;
  const updateFolio=await supabase.from("purchase_orders").update({order_number:folio}).eq("id",orderId);if(updateFolio.error)throw updateFolio.error;
  const poLines=chosen.map(item=>({purchase_order_id:orderId,supply_line_id:lineByMaterial.get(item.material_id)?.id||null,material_id:item.material_id,ordered_qty:item.qty,unit_net_price:item.unit_net_price,line_net:item.qty*item.unit_net_price}));
  const insertedLines=await supabase.from("purchase_order_lines").insert(poLines);if(insertedLines.error)throw insertedLines.error;

  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Órdenes de compra",action:"Crear OC desde consolidado",entity_table:"purchase_orders",entity_id:orderId,new_data:{campaign_id:campaignId,supplier_id:supplierId,supplier:supplier.legal_name,order_number:folio,total_net:totalNet,lines:poLines},observation:"OC creada únicamente desde carencias de levantamientos confirmados; se conserva la asignación por instalación para preparación y guía."});
  revalidatePath("/");
  return{ok:true,id:orderId,order_number:folio,total_net:totalNet};
}
