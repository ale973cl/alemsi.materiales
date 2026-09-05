import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OperationalApp from "@/components/OperationalApp";

const MATERIAL_CATALOG_VIEWS=["material_master_catalog"] as const;
const first=(row:any,keys:string[])=>keys.map(key=>row?.[key]).find(value=>value!==undefined&&value!==null);
const clean=(value:any)=>String(value??"").trim().toLocaleLowerCase("es-CL").replace(/\s+/g," ");
const loadMaterialCatalog=async(supabase:any)=>{let lastError:any=null;for(const view of MATERIAL_CATALOG_VIEWS){const result=await supabase.from(view).select("*").eq("active",true).order("family").order("product");if(!result.error){const source=(result.data||[]).map((row:any)=>({id:first(row,["id","material_id"]),family:first(row,["family","family_name","familia"]),supplier:first(row,["supplier","supplier_name","provider","provider_name","proveedor"]),supplier_code:first(row,["supplier_code","code","codigo"]),product:first(row,["product","product_name","material","material_name","name","producto"]),presentation:first(row,["presentation","presentacion"]),unit:first(row,["unit","unidad"]),net_value:first(row,["net_value","current_net_price","unit_price_net","price_net","valor_neto"]),availability:first(row,["availability","available_quantity","available_stock","stock","disponibilidad"])}));const unique=new Map<string,any>();for(const row of source){const code=clean(row.supplier_code);const key=code?`code|${clean(row.supplier)}|${code}`:`product|${clean(row.family)}|${clean(row.product)}|${clean(row.presentation)}|${clean(row.unit)}|${clean(row.supplier)}`;const current=unique.get(key);if(!current){unique.set(key,{...row,duplicate_count:1});continue}unique.set(key,{...current,family:current.family||row.family,supplier:current.supplier||row.supplier,supplier_code:current.supplier_code||row.supplier_code,product:current.product||row.product,presentation:current.presentation||row.presentation,unit:current.unit||row.unit,net_value:current.net_value??row.net_value,availability:Number(current.availability||0)+Number(row.availability||0),duplicate_count:current.duplicate_count+1})}return{rows:[...unique.values()],sourceCount:source.length,error:null}}lastError=result.error}
 const fallback=await supabase.from("materials").select("id,family,name,presentation,unit,supplier_code,current_net_price,active").eq("active",true).order("family").order("name");
 if(!fallback.error){const rows=(fallback.data||[]).map((row:any)=>({id:row.id,family:row.family,supplier:null,supplier_code:row.supplier_code,product:row.name,presentation:row.presentation,unit:row.unit,net_value:row.current_net_price,availability:0,duplicate_count:1}));return{rows,sourceCount:rows.length,error:null}}
 return{rows:[],sourceCount:0,error:lastError?.message||fallback.error?.message||"El maestro no está accesible para este perfil."}};

const count = async (supabase:any, table:string, filter?:[string,string]) => {
  let query = supabase.from(table).select("id", { count:"exact", head:true });
  if (filter) query = query.eq(filter[0], filter[1]);
  const { count: value } = await query;
  return value || 0;
};

export default async function Page() {
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  let { data: profile } = await supabase.from("user_profiles").select("id,full_name,email,role,active").eq("id", user.id).maybeSingle();
  if (!profile) {
    await supabase.rpc("ensure_my_profile");
    ({ data: profile } = await supabase.from("user_profiles").select("id,full_name,email,role,active").eq("id", user.id).maybeSingle());
  }
  if (!profile?.active) return <main className="blocked"><h1>Acceso pendiente</h1><p>Tu usuario existe, pero todavía no está habilitado por Administración.</p></main>;
  const [clients, installations, materials, openCampaigns, pendingSurveys, openPOs, partialReceipts, openDispatches, financePending, emailPending, campaigns, orders, dispatches, audit, materialCatalog, clientInstallations] = await Promise.all([
    count(supabase,"clients",["active","true"]), count(supabase,"installations",["active","true"]), count(supabase,"materials",["active","true"]),
    count(supabase,"campaigns",["status","Abierta"]), count(supabase,"campaign_installations",["status","Pendiente"]), count(supabase,"purchase_orders",["status","Emitida"]),
    count(supabase,"receipts",["status","Parcial"]), count(supabase,"dispatches",["status","Pendiente"]), count(supabase,"finance_movements",["status","Pendiente"]), count(supabase,"email_queue",["status","Pendiente"]),
    supabase.from("campaigns").select("id,label,status,created_at,contracts(name,clients(legal_name))").order("created_at",{ascending:false}).limit(8),
    supabase.from("purchase_orders").select("id,order_number,status,total_net,created_at,suppliers(legal_name,purchase_order_email)").order("created_at",{ascending:false}).limit(8),
    supabase.from("dispatches").select("id,guide_number,status,created_at,installations(name,region)").order("created_at",{ascending:false}).limit(8),
    supabase.from("activity_log").select("id,module,action,actor_name,created_at").order("created_at",{ascending:false}).limit(10), loadMaterialCatalog(supabase),
    supabase.from("clients").select("id,legal_name,business_center,contracts!inner(id,name,code,active,installations(id,name,region,city,commune,active))").eq("active",true).eq("contracts.active",true).eq("contracts.installations.active",true).order("legal_name"),
  ]);
  return <OperationalApp profile={profile} summary={{clients,installations,materials,openCampaigns,pendingSurveys,openPOs,partialReceipts,openDispatches,financePending,emailPending}} campaigns={campaigns.data||[]} orders={orders.data||[]} dispatches={dispatches.data||[]} audit={audit.data||[]} materialCatalog={materialCatalog.rows} materialCatalogSourceCount={materialCatalog.sourceCount} materialCatalogError={materialCatalog.error} clientInstallations={clientInstallations.data||[]}/>;
}
