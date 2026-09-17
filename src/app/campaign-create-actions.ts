"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createRegionalCampaign(formData: FormData):Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();
  if (!profile?.active || !["Admin Total", "Gerencia", "Admin", "Operaciones"].includes(profile.role)) return;

  const name = String(formData.get("name") || "").trim();
  const periodicity = String(formData.get("periodicity") || "");
  const deliveryPeriod = String(formData.get("delivery_period") || "").trim();
  const deliveryTemplate = String(formData.get("delivery_template") || "Entrega {PERIODO} · {INSTALACION}").trim();
  const installationIds = [...new Set(formData.getAll("installation_ids").map(value => String(value)).filter(Boolean))];
  const allowedPeriodicities = ["Mensual", "Bimensual", "Trimestral", "Cuatrimestral", "Semestral", "Personalizada"];

  if (!name || !allowedPeriodicities.includes(periodicity) || !installationIds.length) return;

  const { data: installations, error: installationError } = await supabase
    .from("installations")
    .select("id,contract_id,region,contracts!inner(id,client_id,active)")
    .in("id", installationIds)
    .eq("active", true)
    .eq("contracts.active", true);

  if (installationError || !installations?.length || installations.length !== installationIds.length) return;

  // La unidad protegida es la instalación: un cliente puede tener varias campañas activas,
  // pero la misma instalación nunca puede estar simultáneamente en dos campañas abiertas.
  const { data: occupied, error: occupiedError } = await supabase
    .from("campaign_installations")
    .select("installation_id,campaigns!inner(id,status)")
    .in("installation_id", installationIds)
    .eq("campaigns.status", "Abierta");
  if (occupiedError || occupied?.length) return;

  const clientIds = [...new Set(installations.map((item: any) => item.contracts?.client_id).filter(Boolean))];
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
  if (error || !campaign) return;

  const { error: linkError } = await supabase.from("campaign_installations").insert(
    installations.map((installation: any) => ({ campaign_id: campaign.id, installation_id: installation.id, status: "Pendiente" })),
  );
  if (linkError) {
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    return;
  }

  revalidatePath("/");
}
