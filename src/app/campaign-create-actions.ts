"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createRegionalCampaign(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no válida");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();
  if (!profile?.active || !["Admin Total", "Gerencia", "Admin"].includes(profile.role)) {
    throw new Error("No autorizado para crear campañas");
  }

  const name = String(formData.get("name") || "").trim();
  const periodicity = String(formData.get("periodicity") || "");
  const installationIds = [...new Set(formData.getAll("installation_ids").map(value => String(value)).filter(Boolean))];
  const allowedPeriodicities = ["Mensual", "Bimensual", "Trimestral", "Cuatrimestral", "Semestral", "Personalizada"];

  if (!name || !allowedPeriodicities.includes(periodicity) || !installationIds.length) {
    throw new Error("Nombre, periodicidad y al menos una instalación son obligatorios");
  }

  const { data: installations, error: installationError } = await supabase
    .from("installations")
    .select("id,contract_id,region,contracts!inner(id,client_id,active)")
    .in("id", installationIds)
    .eq("active", true)
    .eq("contracts.active", true);

  if (installationError) throw installationError;
  if (!installations?.length || installations.length !== installationIds.length) {
    throw new Error("Una o más instalaciones seleccionadas ya no están activas");
  }

  const clientIds = [...new Set(installations.map((item: any) => item.contracts?.client_id).filter(Boolean))];
  const regions = [...new Set(installations.map((item: any) => String(item.region || "Sin región").trim()))];
  const label = JSON.stringify({
    name,
    periodicity,
    clientCount: clientIds.length,
    regionCount: regions.length,
    regions,
  });

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      contract_id: installations[0].contract_id,
      label,
      status: "Abierta",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  const { error: linkError } = await supabase.from("campaign_installations").insert(
    installations.map((installation: any) => ({
      campaign_id: campaign.id,
      installation_id: installation.id,
      status: "Pendiente",
    })),
  );

  if (linkError) {
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    throw linkError;
  }

  revalidatePath("/");
}
