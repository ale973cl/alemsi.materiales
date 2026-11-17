import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OperationalApp from "@/components/OperationalApp";

const MATERIAL_CATALOG_VIEWS=["material_master_catalog"] as const;
const first=(row:any,keys:string[])=>keys.map(key=>row?.[key]).find(value=>value!==undefined&&value!==null);
const clean=(value:any)=>String(value??"").trim().toLocaleLowerCase("es-CL").replace(/\s+/g," ");

const loadMaterialCatalog=async(supabase:any)=>{
 let lastError:any=null;
 for(const view of MATERIAL_CATALOG_VIEWS){
  const result=await supabase.from(view).select("*").eq("active",true).order("family").order("product");
  if(!result.error){
   const source=(result.data||[]).map((row:any)=>({
    id:first(row,["id","material_id"]),family:first(row,["family","family_name","familia"]),
    supplier:first(row,["supplier","supplier_name","provider","provider_name","proveedor"]),
    supplier_code:first(row,["supplier_code","code","codigo"]),
    product:first(row,["product","product_name","material","material_name","name","producto"]),
    presentation:first(row,["presentation","presentacion"]),unit:first(row,["unit","unidad"]),
    net_value:first(row,["net_value","current_net_price","unit_price_net","price_net","valor_neto"]),
    availability:first(row,["availability","available_quantity","available_stock","stock","disponibilidad"])
   }));
   const unique=new Map<string,any>();
   for(const row of source){
    const code=clean(row.supplier_code);
    const key=code?`code|${clean(row.supplier)}|${code}`:`product|${clean(row.family)}|${clean(row.product)}|${clean(row.presentation)}|${clean(row.unit)}|${clean(row.supplier)}`;
    const current=unique.get(key);
    if(!current){unique.set(key,{...row,duplicate_count:1});continue}
    unique.set(key,{...current,family:current.family||row.family,supplier:current.supplier||row.supplier,supplier_code:current.supplier_code||row.supplier_code,product:current.product||row.product,presentation:current.presentation||row.presentation,unit:current.unit||row.unit,net_value:current.net_value??row.net_value,availability:Number(current.availability||0)+Number(row.availability||0),duplicate_count:current.duplicate_count+1});
   }
   return{rows:[...unique.values()],sourceCount:source.length,error:null};
  }
  lastError=result.error;
 }
 const fallback=await supabase.from("materials").select("id,family,name,presentation,unit,supplier_code,current_net_price,active").eq("active",true).order("family").order("name");
 if(!fallback.error){
  const rows=(fallback.data||[]).map((row:any)=>({id:row.id,family:row.family,supplier:null,supplier_code:row.supplier_code,product:row.name,presentation:row.presentation,unit:row.unit,net_value:row.current_net_price,availability:0,duplicate_count:1}));
  return{rows,sourceCount:rows.length,error:null};
 }
 return{rows:[],sourceCount:0,error:lastError?.message||fallback.error?.message||"El maestro no está accesible para este perfil."};
};

const count=async(supabase:any,table:string,filter?:[string,string])=>{
 let query=supabase.from(table).select("id",{count:"exact",head:true});
 if(filter)query=query.eq(filter[0],filter[1]);
 const {count:value}=await query;
 return value||0;
};

const loadConfirmedSurveys=(supabase:any)=>supabase.from("surveys")
 .select("id,campaign_id,installation_id,status,confirmed_at,shortage_net,campaigns(id,label,status),installations(id,name,region,contracts(id,name,clients(id,legal_name))),survey_lines(id,material_id,authorized_qty,physical_remainder,shortage_qty,unit_net_price,line_net,materials(id,name,family,presentation,unit,supplier_code))")
 .eq("status","Confirmada").order("confirmed_at",{ascending:false});

const loadActiveCampaigns=async(supabase:any)=>{
 const {data:campaigns,error}=await supabase.from("campaigns")
  .select("id,label,status,created_at,campaign_installations(campaign_id,installation_id,status,justification,installations(id,name,region,city,commune,contract_id,contracts(id,name,clients(id,legal_name))))")
  .eq("status","Abierta").order("created_at",{ascending:false});
 if(error)return{data:[],error};
 const contractIds=[...new Set((campaigns||[]).flatMap((campaign:any)=>(campaign.campaign_installations||[]).map((row:any)=>row.installations?.contract_id).filter(Boolean)))];
 if(!contractIds.length)return{data:campaigns||[],error:null};
 const {data:profiles,error:profileError}=await supabase.from("contract_materials")
  .select("id,contract_id,installation_id,material_id,authorized,authorized_qty,materials(id,name,family,presentation,unit,current_net_price)")
  .in("contract_id",contractIds);
 if(profileError)return{data:campaigns||[],error:profileError};
 const byContract=new Map<string,any[]>();
 for(const row of profiles||[]){const list=byContract.get(row.contract_id)||[];list.push(row);byContract.set(row.contract_id,list)}
 const merged=(campaigns||[]).map((campaign:any)=>({...campaign,campaign_installations:(campaign.campaign_installations||[]).map((row:any)=>{
  const installation=row.installations;
  const contract=installation?.contracts;
  return{...row,installations:installation?{...installation,contracts:contract?{...contract,contract_materials:byContract.get(installation.contract_id)||[]}:contract}:installation};
 })}));
 return{data:merged,error:null};
};

const loadDispatches=(supabase:any)=>supabase.from("dispatches")
 .select("id,installation_id,guide_number,internal_number,status,observations,parent_dispatch_id,recipient_name,recipient_email,recipient_phone,recipient_rut,recipient_role,recipient_signature,created_at,prepared_at,ready_at,in_transit_at,dispatched_at,delivered_at,cancelled_at,cancellation_reason,email_status,storage_status,complementary_dispatches:dispatches!parent_dispatch_id(id,status,internal_number,guide_number),installations(id,name,address,region,city,commune,delivery_contact_name,delivery_email,delivery_phone,contracts(id,name,code,clients(id,legal_name,rut))),dispatch_lines(id,material_id,required_qty,delivered_qty,pending_qty,materials(id,family,name,supplier_code,presentation,unit))")
 .order("created_at",{ascending:false});

export default async function Page({searchParams}:{searchParams:Promise<{vista?:string}>}){
 const {vista}=await searchParams;
 const view=vista||"inicio";
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 let {data:profile}=await supabase.from("user_profiles").select("id,full_name,email,role,active").eq("id",user.id).maybeSingle();
 if(!profile){
  await supabase.rpc("ensure_my_profile");
  ({data:profile}=await supabase.from("user_profiles").select("id,full_name,email,role,active").eq("id",user.id).maybeSingle());
 }
 if(!profile?.active)return <main className="blocked"><h1>Acceso pendiente</h1><p>Tu usuario existe, pero todavía no está habilitado por Administración.</p></main>;

 let summary={clients:0,installations:0,materials:0,openCampaigns:0,pendingSurveys:0,openPOs:0,partialReceipts:0,openDispatches:0,financePending:0,emailPending:0};
 let campaigns:any[]=[];
 let activeCampaigns:any[]=[];
 let consolidatedSurveys:any[]=[];
 let dispatches:any[]=[];
 let materialCatalog:any[]=[];
 let materialCatalogSourceCount=0;
 let materialCatalogError:string|null=null;
 let masterMaterialCatalog:any[]=[];
 let clientInstallations:any[]=[];
 let masterClientInstallations:any[]=[];
 let users:any[]=[];
 let userInstallationAccess:any[]=[];

 if(view==="inicio"){
  const values=await Promise.all([
   count(supabase,"clients",["active","true"]),count(supabase,"installations",["active","true"]),count(supabase,"materials",["active","true"]),
   count(supabase,"campaigns",["status","Abierta"]),count(supabase,"campaign_installations",["status","Pendiente"]),
   count(supabase,"purchase_orders",["status","Emitida"]),count(supabase,"receipts",["status","Parcial"]),
   count(supabase,"dispatches",["status","Pendiente"]),count(supabase,"finance_movements",["status","Pendiente"]),count(supabase,"email_queue",["status","Pendiente"])
  ]);
  summary={clients:values[0],installations:values[1],materials:values[2],openCampaigns:values[3],pendingSurveys:values[4],openPOs:values[5],partialReceipts:values[6],openDispatches:values[7],financePending:values[8],emailPending:values[9]};
 }

 if(view==="campañas"){
  const [campaignResult,clientsResult]=await Promise.all([
   supabase.from("campaigns").select("id,label,status,created_at,contracts(name,clients(legal_name)),campaign_installations(campaign_id,installation_id,status,justification,installations(id,name,region,city,commune,contracts(id,name,clients(id,legal_name))))").order("created_at",{ascending:false}),
   supabase.from("clients").select("id,legal_name,rut,business_center,contracts!inner(id,name,code,net_budget,active,installations(id,name,address,region,city,commune,surface_m2,collaborator_count,delivery_contact_name,delivery_email,delivery_phone,phone,general_email,active))").eq("active",true).eq("contracts.active",true).eq("contracts.installations.active",true).order("legal_name")
  ]);
  campaigns=campaignResult.data||[];clientInstallations=clientsResult.data||[];
 }

 if(view==="levantamientos"){
  const [active,surveys]=await Promise.all([loadActiveCampaigns(supabase),loadConfirmedSurveys(supabase)]);
  activeCampaigns=active.data||[];consolidatedSurveys=surveys.data||[];
 }

 if(view==="consolidado"||view==="compras"||view==="preparacion"){
  const surveys=await loadConfirmedSurveys(supabase);consolidatedSurveys=surveys.data||[];
  if(view==="preparacion"){const d=await loadDispatches(supabase);dispatches=d.data||[]}
 }

 if(view==="entregas"){
  const [dispatchResult,campaignResult,clientsResult,catalogResult,usersResult]=await Promise.all([
   loadDispatches(supabase),
   supabase.from("campaigns").select("id,label,status,created_at,contracts(name,clients(legal_name)),campaign_installations(campaign_id,installation_id,status,justification,installations(id,name,region,city,commune,contracts(id,name,clients(id,legal_name))))").order("created_at",{ascending:false}),
   supabase.from("clients").select("id,legal_name,rut,business_center,contracts!inner(id,name,code,net_budget,active,installations(id,name,address,region,city,commune,surface_m2,collaborator_count,delivery_contact_name,delivery_email,delivery_phone,phone,general_email,active))").eq("active",true).eq("contracts.active",true).eq("contracts.installations.active",true).order("legal_name"),
   loadMaterialCatalog(supabase),
   supabase.from("user_profiles").select("id,full_name,email,role,active,created_at").eq("active",true).order("full_name")
  ]);
  dispatches=dispatchResult.data||[];campaigns=campaignResult.data||[];clientInstallations=clientsResult.data||[];
  materialCatalog=catalogResult.rows;materialCatalogSourceCount=catalogResult.sourceCount;materialCatalogError=catalogResult.error;users=usersResult.data||[];
 }

 if(view==="clientes"){
  const [catalogResult,inactiveResult,clientsResult,campaignResult,usersResult,accessResult]=await Promise.all([
   loadMaterialCatalog(supabase),
   supabase.from("materials").select("id,family,name,presentation,unit,supplier_code,current_net_price,active").eq("active",false).order("family").order("name"),
   supabase.from("clients").select("id,legal_name,rut,business_center,active,contracts(id,name,code,net_budget,active,installations(id,name,address,region,city,commune,surface_m2,collaborator_count,delivery_contact_name,delivery_email,delivery_phone,phone,general_email,active))").order("legal_name"),
   supabase.from("campaigns").select("id,label,status,created_at,campaign_installations(campaign_id,installation_id,status,justification,installations(id,name))").order("created_at",{ascending:false}),
   supabase.from("user_profiles").select("id,full_name,email,role,active,created_at").order("full_name"),
   supabase.from("user_installation_access").select("id,user_id,installation_id,active,can_view_master,can_survey")
  ]);
  materialCatalog=catalogResult.rows;materialCatalogSourceCount=catalogResult.sourceCount;materialCatalogError=catalogResult.error;
  masterMaterialCatalog=[
   ...catalogResult.rows.map((row:any)=>({...row,active:true})),
   ...(inactiveResult.data||[]).map((row:any)=>({id:row.id,family:row.family,supplier:null,supplier_code:row.supplier_code,product:row.name,presentation:row.presentation,unit:row.unit,net_value:row.current_net_price,availability:0,duplicate_count:1,active:false}))
  ];
  masterClientInstallations=clientsResult.data||[];campaigns=campaignResult.data||[];users=usersResult.data||[];userInstallationAccess=accessResult.data||[];
 }

 return <OperationalApp initialTab={view} profile={profile} summary={summary}
  campaigns={campaigns} activeCampaigns={activeCampaigns} consolidatedSurveys={consolidatedSurveys}
  orders={[]} dispatches={dispatches} audit={[]}
  materialCatalog={materialCatalog} materialCatalogSourceCount={materialCatalogSourceCount} materialCatalogError={materialCatalogError}
  masterMaterialCatalog={masterMaterialCatalog} clientInstallations={clientInstallations} masterClientInstallations={masterClientInstallations}
  users={users} userInstallationAccess={userInstallationAccess}/>;
}
