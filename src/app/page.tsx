import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OperationalApp from "@/components/OperationalApp";

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
  const [clients, installations, materials, openCampaigns, pendingSurveys, openPOs, partialReceipts, openDispatches, financePending, emailPending, campaigns, orders, dispatches, audit] = await Promise.all([
    count(supabase,"clients",["active","true"]), count(supabase,"installations",["active","true"]), count(supabase,"materials",["active","true"]),
    count(supabase,"campaigns",["status","Abierta"]), count(supabase,"campaign_installations",["status","Pendiente"]), count(supabase,"purchase_orders",["status","Emitida"]),
    count(supabase,"receipts",["status","Parcial"]), count(supabase,"dispatches",["status","Pendiente"]), count(supabase,"finance_movements",["status","Pendiente"]), count(supabase,"email_queue",["status","Pendiente"]),
    supabase.from("campaigns").select("id,label,status,created_at,contracts(name,clients(legal_name))").order("created_at",{ascending:false}).limit(8),
    supabase.from("purchase_orders").select("id,order_number,status,total_net,created_at,suppliers(legal_name,purchase_order_email)").order("created_at",{ascending:false}).limit(8),
    supabase.from("dispatches").select("id,guide_number,status,created_at,installations(name,region)").order("created_at",{ascending:false}).limit(8),
    supabase.from("activity_log").select("id,module,action,actor_name,created_at").order("created_at",{ascending:false}).limit(10),
  ]);
  return <OperationalApp profile={profile} summary={{clients,installations,materials,openCampaigns,pendingSurveys,openPOs,partialReceipts,openDispatches,financePending,emailPending}} campaigns={campaigns.data||[]} orders={orders.data||[]} dispatches={dispatches.data||[]} audit={audit.data||[]}/>;
}
