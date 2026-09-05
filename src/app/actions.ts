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

export async function signOut() { const supabase=await createClient(); await supabase.auth.signOut(); redirect("/login"); }

export async function createCampaign(formData:FormData) {
  const {supabase,user}=await context(["Admin Total","Gerencia","Admin"]);
  const contractId=String(formData.get("contract_id")||""); const label=String(formData.get("label")||"").trim();
  if(!contractId||!label) throw new Error("Contrato y período son obligatorios");
  const {data:installations,error:iError}=await supabase.from("installations").select("id").eq("contract_id",contractId).eq("active",true);
  if(iError||!installations?.length) throw new Error("El contrato no tiene instalaciones activas; no se puede abrir un universo vacío");
  const {data:campaign,error}=await supabase.from("campaigns").insert({contract_id:contractId,label,status:"Abierta",created_by:user.id}).select("id").single();
  if(error) throw error;
  const {error:linkError}=await supabase.from("campaign_installations").insert(installations.map((i:any)=>({campaign_id:campaign.id,installation_id:i.id,status:"Pendiente"})));
  if(linkError) throw linkError;
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
