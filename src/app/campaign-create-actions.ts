"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type CampaignCreateResult={ok:boolean;error?:string;campaignId?:string};

export async function createRegionalCampaign(formData: FormData):Promise<CampaignCreateResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {ok:false,error:"Sesión no válida"};

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();
  if (!profile?.active || !["Admin Total", "Gerencia", "Admin", "Operaciones"].includes(profile.role)) {
    return {ok:false,error:"No autorizado para crear campañas"};
  }

  const name = String(formData.get("name") || "").trim();
  const periodicity = String(formData.get("periodicity") || "");
  const deliveryPeriod = String(formData.get("delivery_period") || "").trim();
  const deliveryTemplate = String(formData.get("delivery_template") || "Entrega {PERIODO} · {INSTALACION}").trim();
  const installationIds = [...new Set(formData.getAll("installation_ids").map(value => String(value)).filter(Boolean))];
  const allowedPeriodicities = ["Mensual", "Bimensual", "Trimestral", "Cuatrimestral", "Semestral", "Personalizada"];

  if (!name || !allowedPeriodicities.includes(periodicity) || !installationIds.length) {
    return {ok:false,error:"Nombre, periodicidad y al menos una instalación son obligatorios"};
  }

  const { data: installations, error: installationError } = await supabase
    .from("installations")
    .select("id,contract_id,region,contracts!inner(id,client_id,active)")
    .in("id", installationIds)
    .eq("active", true)
    .eq("contracts.active", true);

  if (installationError) return {ok:false,error:installationError.message};
  if (!installations?.length || installations.length !== installationIds.length) {
    return {ok:false,error:"Una o más instalaciones seleccionadas ya no están activas"};
  }

  const clientIds = [...new Set(installations.map((item: any) => item.contracts?.client_id).filter(Boolean))];

  // Regla de campaña: un cliente completo solo puede pertenecer a una campaña abierta.
  // Se valida en servidor para evitar duplicidad aunque dos usuarios trabajen al mismo tiempo.
  const { data: activeClientLinks, error: activeClientError } = await supabase
    .from("campaign_installations")
    .select("installation_id,campaigns!inner(id,label,status),installations!inner(id,contracts!inner(client_id))")
    .eq("campaigns.status", "Abierta");
  if (activeClientError) return {ok:false,error:activeClientError.message};

  const occupiedClientIds = new Set((activeClientLinks||[]).map((item:any)=>item.installations?.contracts?.client_id).filter(Boolean));
  const conflictingClientIds = clientIds.filter(id=>occupiedClientIds.has(id));
  if (conflictingClientIds.length) {
    return {ok:false,error:`${conflictingClientIds.length} cliente(s) ya pertenecen a una campaña activa. Debes cerrar esa campaña antes de incorporarlos a otra.`};
  }

  // Segunda protección por instalación para conservar la regla histórica del circuito.
  const { data: occupied, error: occupiedError } = await supabase
    .from("campaign_installations")
    .select("installation_id,campaigns!inner(id,status)")
    .in("installation_id", installationIds)
    .eq("campaigns.status", "Abierta");
  if (occupiedError) return {ok:false,error:occupiedError.message};
  if (occupied?.length) {
    return {ok:false,error:`${occupied.length} instalación(es) ya pertenecen a una campaña activa. Actualiza la pantalla y selecciona solo instalaciones disponibles.`};
  }

  const regions = [...new Set(installations.map((item: any) => String(item.region || "Sin región").trim()))];
  const label = JSON.stringify({
    name,
    periodicity,
    deliveryPeriod,
    deliveryTemplate: deliveryTemplate || "Entrega {PERIODO} · {INSTALACION}",
    clientCount: clientIds.length,
    regionCount: regions.length,
    regions,
  });

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({ contract_id: installations[0].contract_id, label, status: "Abierta", created_by: user.id })
    .select("id")
    .single();
  if (error) return {ok:false,error:error.message};

  const { error: linkError } = await supabase.from("campaign_installations").insert(
    installations.map((installation: any) => ({ campaign_id: campaign.id, installation_id: installation.id, status: "Pendiente" })),
  );
  if (linkError) {
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    return {ok:false,error:linkError.message};
  }

  revalidatePath("/");
  return {ok:true,campaignId:campaign.id};
}
