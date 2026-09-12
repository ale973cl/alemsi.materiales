"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function context(allowed:string[]) {
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no válida");
  const { data: profile } = await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if (!profile?.active || !allowed.includes(profile.role)) throw new Error("No autorizado para esta operación");
  return { supabase, user, profile };
}

async function audit(supabase:any,user:any,profile:any,data:{module:string;action:string;entity_table:string;entity_id?:string;old_data?:any;new_data?:any;observation?:string}) {
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,...data});
}

export async function signOut() { const supabase=await createClient(); await supabase.auth.signOut(); redirect("/login"); }

export async function createCampaign(formData:FormData) {
  const {supabase,user}=await context(["Admin Total","Gerencia","Admin"]);
  const clientIds=[...new Set(formData.getAll("client_ids").map(value=>String(value)).filter(Boolean))];
  const name=String(formData.get("name")||"").trim();
  const periodicity=String(formData.get("periodicity")||"");
  const allowedPeriodicities=["Mensual","Bimensual","Trimestral","Cuatrimestral","Semestral","Personalizada"];
  if(!clientIds.length||!name||!allowedPeriodicities.includes(periodicity)) throw new Error("Nombre, periodicidad y al menos un cliente son obligatorios");
  const {data:contracts,error:contractError}=await supabase.from("contracts").select("id").in("client_id",clientIds).eq("active",true);
  if(contractError||!contracts?.length) throw new Error("Los clientes seleccionados no tienen contratos activos");
  const {data:installations,error:installationError}=await supabase.from("installations").select("id,contract_id").in("contract_id",contracts.map((contract:any)=>contract.id)).eq("active",true);
  if(installationError||!installations?.length) throw new Error("Los clientes seleccionados no tienen instalaciones activas");
  const label=JSON.stringify({name,periodicity,clientCount:clientIds.length});
  const {data:campaign,error}=await supabase.from("campaigns").insert({contract_id:installations[0].contract_id,label,status:"Abierta",created_by:user.id}).select("id").single();
  if(error) throw error;
  const {error:linkError}=await supabase.from("campaign_installations").insert(installations.map((installation:any)=>({campaign_id:campaign.id,installation_id:installation.id,status:"Pendiente"})));
  if(linkError){await supabase.from("campaigns").delete().eq("id",campaign.id);throw linkError;}
  revalidatePath("/");
}

export async function closeCampaign(formData:FormData) {
  const {supabase}=await context(["Admin Total","Gerencia","Admin"]); const id=String(formData.get("campaign_id")||"");
  const {data:pending}=await supabase.from("campaign_installations").select("installation_id,status,justification").eq("campaign_id",id).neq("status","Completada");
  const unjustified=(pending||[]).filter((x:any)=>!x.justification?.trim());
  if(unjustified.length) throw new Error(`No se puede cerrar: ${unjustified.length} instalaciones están pendientes sin justificación`);
  const {error}=await supabase.from("campaigns").update({status:"Cerrada",closed_at:new Date().toISOString()}).eq("id",id);
  if(error) throw error; revalidatePath("/");
}

export async function derivePurchaseOrder(formData:FormData) {
  const {supabase,user,profile}=await context(["Admin Total","Gerencia","Admin"]); const id=String(formData.get("purchase_order_id")||"");
  const {data:po,error}=await supabase.from("purchase_orders").select("id,order_number,total_net,suppliers(legal_name,purchase_order_email)").eq("id",id).single();
  if(error||!po) throw new Error("Orden de compra no encontrada");
  const supplier:any=Array.isArray(po.suppliers)?po.suppliers[0]:po.suppliers;
  const {data:fin}=await supabase.from("user_profiles").select("email").eq("role","Finanzas").eq("active",true);
  const financeEmails=(fin||[]).map((x:any)=>x.email).filter(Boolean);
  await supabase.from("finance_movements").insert({movement_type:"Pago OC",status:"Pendiente",amount_net:Number(po.total_net||0),reference:po.order_number||po.id,recipient_name:supplier?.legal_name,recipient_email:supplier?.purchase_order_email,created_by:user.id,observation:"Derivada por Operaciones/Gerencia; costo neto, IVA separado al registrar factura."});
  const to=supplier?.purchase_order_email?[supplier.purchase_order_email]:financeEmails; const cc=supplier?.purchase_order_email?financeEmails:[];
  if(to.length) await supabase.from("email_queue").insert({email_type:"purchase_order_derived",related_table:"purchase_orders",related_id:po.id,to_addresses:to,cc_addresses:cc,subject:`Orden de compra ${po.order_number||"pendiente de folio"} · ALEMSI`,payload:{module:"Órdenes de compra",event:"derived_to_finance",supplier:supplier?.legal_name,amount_net:po.total_net,derived_by:profile.full_name||profile.email}});
  revalidatePath("/");
}

export async function createClientWithContract(formData:FormData) {
  const {supabase,user,profile}=await context(["Admin Total","Gerencia"]);
  const legalName=String(formData.get("legal_name")||"").trim();
  const contractName=String(formData.get("contract_name")||"").trim();
  const businessCenter=String(formData.get("business_center")||"").trim()||null;
  if(!legalName||!contractName) throw new Error("Cliente y nombre del contrato son obligatorios");
  const {data:client,error}=await supabase.from("clients").insert({legal_name:legalName,business_center:businessCenter,active:true}).select("id,legal_name,business_center").single();
  if(error) throw error;
  const {data:contract,error:contractError}=await supabase.from("contracts").insert({client_id:client.id,name:contractName,active:true}).select("id,name").single();
  if(contractError) { await supabase.from("clients").update({active:false}).eq("id",client.id); throw contractError; }
  await audit(supabase,user,profile,{module:"Clientes e instalaciones",action:"Crear cliente y contrato",entity_table:"clients",entity_id:client.id,new_data:{client,contract}});
  revalidatePath("/");
}

export async function renameContract(formData:FormData) {
  const {supabase,user,profile}=await context(["Admin Total","Gerencia"]);
  const id=String(formData.get("contract_id")||""); const name=String(formData.get("name")||"").trim();
  if(!id||!name) throw new Error("Contrato y nombre son obligatorios");
  const {data:old}=await supabase.from("contracts").select("id,name").eq("id",id).single();
  const {data,error}=await supabase.from("contracts").update({name,updated_at:new Date().toISOString()}).eq("id",id).select("id,name").single();
  if(error) throw error;
  await audit(supabase,user,profile,{module:"Clientes e instalaciones",action:"Editar nombre de contrato",entity_table:"contracts",entity_id:id,old_data:old,new_data:data});
  revalidatePath("/");
}

export async function createInstallation(formData:FormData) {
  const {supabase,user,profile}=await context(["Admin Total","Gerencia"]);
  const contractId=String(formData.get("contract_id")||""); const name=String(formData.get("name")||"").trim();
  const region=String(formData.get("region")||"").trim()||null; const city=String(formData.get("city")||"").trim()||null; const commune=String(formData.get("commune")||"").trim()||city;
  if(!contractId||!name) throw new Error("Contrato y nombre de instalación son obligatorios");
  const {data,error}=await supabase.from("installations").insert({contract_id:contractId,name,region,city,commune,active:true}).select("id,name,region,city,commune,contract_id").single();
  if(error) throw error;
  await audit(supabase,user,profile,{module:"Clientes e instalaciones",action:"Agregar instalación",entity_table:"installations",entity_id:data.id,new_data:data});
  revalidatePath("/");
}

export async function createMaterial(formData:FormData) {
  const {supabase,user,profile}=await context(["Admin Total","Gerencia"]);
  const row={family:String(formData.get("family")||"").trim()||null,name:String(formData.get("name")||"").trim(),presentation:String(formData.get("presentation")||"").trim()||null,unit:String(formData.get("unit")||"").trim()||null,supplier_code:String(formData.get("supplier_code")||"").trim()||null,current_net_price:Number(formData.get("current_net_price")||0),active:true,price_source_note:"Ingreso manual trazable"};
  if(!row.name) throw new Error("El nombre del producto es obligatorio");
  const {data,error}=await supabase.from("materials").insert(row).select("id,name,family,presentation,unit,supplier_code,current_net_price").single();
  if(error) throw error;
  await audit(supabase,user,profile,{module:"Maestro de materiales",action:"Crear producto",entity_table:"materials",entity_id:data.id,new_data:data});
  revalidatePath("/");
}

const parseCsvLine=(line:string,delimiter:string)=>{const values:string[]=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(char===delimiter&&!quoted){values.push(value.trim());value=""}else value+=char}values.push(value.trim());return values};
export async function importMaterialsCsv(formData:FormData) {
  const {supabase,user,profile}=await context(["Admin Total","Gerencia"]); const file=formData.get("file");
  if(!(file instanceof File)||!file.size) throw new Error("Selecciona un archivo CSV");
  if(file.size>2_000_000) throw new Error("El CSV supera el máximo de 2 MB");
  const content=(await file.text()).replace(/^\uFEFF/,""); const lines=content.split(/\r?\n/).filter(line=>line.trim()); if(lines.length<2) throw new Error("El CSV no contiene productos");
  const delimiter=lines[0].includes(";")?";":","; const headers=parseCsvLine(lines[0],delimiter).map(value=>value.toLowerCase());
  const required=["familia","producto","presentacion","unidad","codigo_proveedor","valor_neto"]; if(required.some(key=>!headers.includes(key))) throw new Error("La plantilla CSV no tiene las columnas requeridas");
  const rows=lines.slice(1).map(line=>{const values=parseCsvLine(line,delimiter);const get=(key:string)=>values[headers.indexOf(key)]||"";return{family:get("familia")||null,name:get("producto").trim(),presentation:get("presentacion")||null,unit:get("unidad")||null,supplier_code:get("codigo_proveedor")||null,current_net_price:Number(get("valor_neto").replace(/\./g,"").replace(",","."))||0,active:true,price_source_note:`Carga CSV: ${file.name}`}}).filter(row=>row.name);
  if(!rows.length) throw new Error("No se encontraron productos válidos");
  const {data,error}=await supabase.from("materials").insert(rows).select("id"); if(error) throw error;
  await audit(supabase,user,profile,{module:"Maestro de materiales",action:"Carga masiva CSV",entity_table:"materials",new_data:{file:file.name,rows:data?.length||rows.length},observation:"Carga preservada como ingreso explícito; no reemplaza productos existentes."});
  revalidatePath("/");
}

export async function importClientsInstallationsCsv(formData:FormData) {
  const {supabase,user,profile}=await context(["Admin Total","Gerencia"]); const file=formData.get("file");
  if(!(file instanceof File)||!file.size) throw new Error("Selecciona un archivo CSV");
  if(file.size>2_000_000) throw new Error("El CSV supera el máximo de 2 MB");
  const content=(await file.text()).replace(/^\uFEFF/,""); const lines=content.split(/\r?\n/).filter(line=>line.trim());
  if(lines.length<2) throw new Error("El CSV no contiene registros");
  const delimiter=lines[0].includes(";")?";":","; const headers=parseCsvLine(lines[0],delimiter).map(value=>value.toLowerCase().trim());
  const required=["cliente","contrato","instalacion","direccion","region","ciudad","comuna","contacto_recepcion","correo_contacto","telefono_contacto"];
  if(required.some(key=>!headers.includes(key))) throw new Error("La plantilla CSV no tiene las columnas requeridas");
  const getValue=(values:string[],key:string)=>values[headers.indexOf(key)]?.trim()||"";
  let clientsCreated=0,contractsCreated=0,installationsCreated=0,installationsUpdated=0;
  for(const line of lines.slice(1)){
    const values=parseCsvLine(line,delimiter); const clientName=getValue(values,"cliente"); if(!clientName) continue;
    let {data:client}=await supabase.from("clients").select("id,legal_name").ilike("legal_name",clientName).limit(1).maybeSingle();
    if(!client){const created=await supabase.from("clients").insert({legal_name:clientName,active:true}).select("id,legal_name").single();if(created.error)throw created.error;client=created.data;clientsCreated++;}
    const contractName=getValue(values,"contrato")||`Contrato ${clientName}`;
    let {data:contract}=await supabase.from("contracts").select("id,name").eq("client_id",client.id).ilike("name",contractName).limit(1).maybeSingle();
    if(!contract){const created=await supabase.from("contracts").insert({client_id:client.id,name:contractName,active:true}).select("id,name").single();if(created.error)throw created.error;contract=created.data;contractsCreated++;}
    const installationName=getValue(values,"instalacion")||clientName;
    const installation={contract_id:contract.id,name:installationName,address:getValue(values,"direccion")||null,region:getValue(values,"region")||null,city:getValue(values,"ciudad")||null,commune:getValue(values,"comuna")||null,delivery_contact_name:getValue(values,"contacto_recepcion")||null,delivery_email:getValue(values,"correo_contacto")||null,delivery_phone:getValue(values,"telefono_contacto")||null,active:true};
    const {data:existing}=await supabase.from("installations").select("id").eq("contract_id",contract.id).ilike("name",installationName).limit(1).maybeSingle();
    if(existing){const updated=await supabase.from("installations").update(installation).eq("id",existing.id);if(updated.error)throw updated.error;installationsUpdated++;}
    else{const created=await supabase.from("installations").insert(installation);if(created.error)throw created.error;installationsCreated++;}
  }
  if(!(clientsCreated+contractsCreated+installationsCreated+installationsUpdated)) throw new Error("No se encontraron filas válidas");
  await audit(supabase,user,profile,{module:"Clientes e instalaciones",action:"Carga masiva CSV",entity_table:"installations",new_data:{file:file.name,clientsCreated,contractsCreated,installationsCreated,installationsUpdated},observation:"Las coincidencias se actualizaron; no se duplicaron."});
  revalidatePath("/");
}

const USER_ROLES=["Admin Total","Gerencia","Supervisora","Finanzas","Bodega"] as const;
export async function inviteUser(formData:FormData){
  const {supabase}=await context(["Admin Total"]);const fullName=String(formData.get("full_name")||"").trim();const email=String(formData.get("email")||"").trim().toLowerCase();const role=String(formData.get("role")||"");const active=String(formData.get("active")||"")==="true";
  if(!fullName||!/^\S+@\S+\.\S+$/.test(email)||!USER_ROLES.includes(role as typeof USER_ROLES[number]))throw new Error("Nombre, correo y rol válido son obligatorios");
  const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("Sesión no válida");
  const deploymentHost=process.env.VERCEL_BRANCH_URL||process.env.VERCEL_URL;
  const appUrl=deploymentHost?`https://${deploymentHost}`:process.env.NEXT_PUBLIC_APP_URL;
  if(!appUrl)throw new Error("No se pudo determinar la URL desplegada para la invitación");
  const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-material-user`,{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({full_name:fullName,email,role,active,redirect_to:`${appUrl.replace(/\/$/,"")}/login`})});
  const result=await response.json();
  if(!response.ok){
    if(/already been registered|ya (?:está|esta) registrado/i.test(String(result.error||""))){revalidatePath("/");return{ok:false,error:"El correo ya está registrado"};}
    throw new Error(result.error||"No se pudo invitar al usuario");
  }
  revalidatePath("/");return result;
}
export async function updateUserProfile(formData:FormData) {
  const {supabase,user,profile}=await context(["Admin Total"]); const id=String(formData.get("user_id")||"");
  const fullName=String(formData.get("full_name")||"").trim(); const role=String(formData.get("role")||""); const active=String(formData.get("active")||"")==="true";
  if(!id||!fullName||!USER_ROLES.includes(role as typeof USER_ROLES[number])) throw new Error("Usuario, nombre y rol válido son obligatorios");
  if(id===user.id&&(!active||role!=="Admin Total")) throw new Error("No puedes quitar tu propio acceso de Admin Total");
  const {data:old,error:readError}=await supabase.from("user_profiles").select("id,full_name,email,role,active").eq("id",id).single(); if(readError)throw readError;
  const {data,error}=await supabase.from("user_profiles").update({full_name:fullName,role,active,updated_at:new Date().toISOString()}).eq("id",id).select("id,full_name,email,role,active").single(); if(error)throw error;
  await audit(supabase,user,profile,{module:"Usuarios",action:"Actualizar perfil",entity_table:"user_profiles",entity_id:id,old_data:old,new_data:data}); revalidatePath("/");
}
export async function setUserInstallationAccess(formData:FormData) {
  const {supabase,user,profile}=await context(["Admin Total"]); const userId=String(formData.get("user_id")||""); const installationId=String(formData.get("installation_id")||""); const granted=String(formData.get("granted")||"")==="true";
  if(!userId||!installationId) throw new Error("Usuario e instalación son obligatorios");
  const {data:existing,error:readError}=await supabase.from("user_installation_access").select("id,active").eq("user_id",userId).eq("installation_id",installationId).maybeSingle(); if(readError)throw readError;
  if(existing){const {error}=await supabase.from("user_installation_access").update({active:granted,can_view_master:true,can_survey:true,updated_at:new Date().toISOString()}).eq("id",existing.id);if(error)throw error;}
  else if(granted){const {error}=await supabase.from("user_installation_access").insert({user_id:userId,installation_id:installationId,can_view_master:true,can_survey:true,active:true});if(error)throw error;}
  await audit(supabase,user,profile,{module:"Usuarios",action:granted?"Asignar instalación":"Retirar instalación",entity_table:"user_installation_access",entity_id:existing?.id,new_data:{user_id:userId,installation_id:installationId,active:granted}}); revalidatePath("/");
}

export async function createDispatchV1(input:{installationId:string;observations?:string;lines:{material_id:string;quantity:number}[]}){
  const {supabase}=await context(["Admin Total","Admin","Bodega"]);
  const {data,error}=await supabase.rpc("create_dispatch_v1",{p_installation_id:input.installationId,p_lines:input.lines,p_observations:input.observations||null});
  if(error)throw new Error(error.message);revalidatePath("/");return data as string;
}
export async function transitionDispatchV1(dispatchId:string,status:string,reason?:string){
  const {supabase}=await context(["Admin Total","Admin","Bodega"]);
  const {data,error}=await supabase.rpc("transition_dispatch_v1",{p_dispatch_id:dispatchId,p_status:status,p_reason:reason||null});
  if(error)throw new Error(error.message);revalidatePath("/");return data as string;
}
export async function registerDispatchDeliveryV1(input:{dispatchId:string;recipientName:string;recipientRut:string;recipientRole?:string;observations?:string;signature?:string;lines:{line_id:string;delivered_qty:number}[]}){
  const {supabase}=await context(["Admin Total","Admin","Bodega","Supervisora"]);
  const {data,error}=await supabase.rpc("register_dispatch_delivery_v1",{p_dispatch_id:input.dispatchId,p_lines:input.lines,p_recipient_name:input.recipientName,p_recipient_rut:input.recipientRut,p_recipient_role:input.recipientRole||null,p_observations:input.observations||null,p_signature:input.signature||null});
  if(error)throw new Error(error.message);revalidatePath("/");return data as string;
}

export async function saveSurvey(formData:FormData) {
  const {supabase,user}=await context(["Admin Total","Gerencia","Admin","Supervisora"]);
  const campaignId=String(formData.get("campaign_id")||""); const installationId=String(formData.get("installation_id")||"");
  const submitted=JSON.parse(String(formData.get("lines")||"[]")) as {material_id:string;physical_remainder:number}[];
  const {data:membership,error:membershipError}=await supabase.from("campaign_installations").select("campaign_id,installation_id,installations(contract_id)").eq("campaign_id",campaignId).eq("installation_id",installationId).single();
  if(membershipError||!membership) throw new Error("La instalación no pertenece al universo de la campaña");
  const contractId=(membership.installations as any)?.contract_id;
  const {data:authorized,error:materialsError}=await supabase.from("contract_materials").select("material_id,installation_id,authorized_qty,materials(current_net_price)").eq("contract_id",contractId).eq("authorized",true).or(`installation_id.is.null,installation_id.eq.${installationId}`);
  if(materialsError) throw materialsError;
  const byMaterial=new Map<string,any>(); for(const item of authorized||[]){if(!byMaterial.has(item.material_id)||item.installation_id===installationId)byMaterial.set(item.material_id,item)}
  if(!byMaterial.size) throw new Error("La instalación no tiene materiales autorizados");
  if(submitted.length!==byMaterial.size||submitted.some(line=>!byMaterial.has(line.material_id)||Number(line.physical_remainder)<0)) throw new Error("El levantamiento no coincide con los materiales autorizados");
  const lines=submitted.map(line=>{const source=byMaterial.get(line.material_id);const authorizedQty=Number(source.authorized_qty||0);const remainder=Number(line.physical_remainder||0);const shortage=Math.max(authorizedQty-remainder,0);const price=Number(source.materials?.current_net_price||0);return{material_id:line.material_id,authorized_qty:authorizedQty,physical_remainder:remainder,shortage_qty:shortage,unit_net_price:price,line_net:shortage*price}});
  const shortageNet=lines.reduce((sum,line)=>sum+line.line_net,0);
  const {data:survey,error:surveyError}=await supabase.from("surveys").upsert({campaign_id:campaignId,installation_id:installationId,supervisor_id:user.id,status:"Borrador",shortage_net:shortageNet,confirmed_at:null},{onConflict:"campaign_id,installation_id"}).select("id,campaign_id,installation_id").single();
  if(surveyError||!survey||survey.campaign_id!==campaignId||survey.installation_id!==installationId) throw surveyError||new Error("No se pudo asociar el levantamiento a la campaña e instalación");
  const {error:deleteError}=await supabase.from("survey_lines").delete().eq("survey_id",survey.id); if(deleteError)throw deleteError;
  const {data:savedLines,error:insertError}=await supabase.from("survey_lines").insert(lines.map(line=>({...line,survey_id:survey.id}))).select("id,survey_id");
  if(insertError||savedLines?.length!==lines.length||savedLines.some(line=>line.survey_id!==survey.id)) throw insertError||new Error("No se guardaron todas las líneas del levantamiento");
  const confirmedAt=new Date().toISOString();
  const {data:confirmed,error:confirmError}=await supabase.from("surveys").update({status:"Confirmada",confirmed_at:confirmedAt,shortage_net:shortageNet}).eq("id",survey.id).eq("campaign_id",campaignId).eq("installation_id",installationId).select("id,status").single();
  if(confirmError||confirmed?.status!=="Confirmada") throw confirmError||new Error("No se pudo confirmar el levantamiento");
  const {data:completed,error:completeError}=await supabase.from("campaign_installations").update({status:"Completada",completed_at:confirmedAt,supervisor_id:user.id}).eq("campaign_id",campaignId).eq("installation_id",installationId).select("campaign_id,installation_id,status").single();
  if(completeError||completed?.status!=="Completada") throw completeError||new Error("No se pudo marcar la instalación como completada");
  revalidatePath("/");
}
