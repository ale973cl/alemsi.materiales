import { CAPABILITIES, roleCan } from "@/lib/authorization";

type InstallationScope = {
  id: string;
  region?: string | null;
  commune?: string | null;
};

export async function getOperationalScope(
  supabase: any,
  userId: string,
  role: string,
) {
  if (!roleCan(role, CAPABILITIES.ROUTE_ACCESS))
    return {
      canAccessRoutes: false,
      unrestricted: false,
      installationIds: new Set<string>(),
    };
  if (role !== "Supervisora")
    return {
      canAccessRoutes: true,
      unrestricted: true,
      installationIds: new Set<string>(),
    };

  const [
    { data: direct, error: directError },
    { data: territorial, error: territorialError },
  ] = await Promise.all([
    supabase
      .from("user_installation_access")
      .select("installation_id")
      .eq("user_id", userId),
    supabase
      .from("user_territorial_scopes")
      .select("region,commune")
      .eq("user_id", userId)
      .eq("active", true),
  ]);
  if (directError || territorialError)
    throw new Error("No se pudo validar el alcance operacional del usuario");

  const installationIds = new Set<string>(
    (direct || []).map((row: any) => String(row.installation_id)),
  );
  if ((territorial || []).length) {
    const { data: installations, error: installationError } = await supabase
      .from("installations")
      .select("id,region,commune")
      .eq("active", true);
    if (installationError)
      throw new Error(
        "No se pudieron resolver las instalaciones del alcance territorial",
      );
    for (const installation of (installations || []) as InstallationScope[]) {
      const matches = (territorial || []).some(
        (scope: any) =>
          String(scope.region || "")
            .trim()
            .toLocaleLowerCase("es-CL") ===
            String(installation.region || "")
              .trim()
              .toLocaleLowerCase("es-CL") &&
          (!scope.commune ||
            String(scope.commune).trim().toLocaleLowerCase("es-CL") ===
              String(installation.commune || "")
                .trim()
                .toLocaleLowerCase("es-CL")),
      );
      if (matches) installationIds.add(String(installation.id));
    }
  }
  return { canAccessRoutes: true, unrestricted: false, installationIds };
}

export function routeIsInScope(
  route: any,
  userId: string,
  installationIds: Set<string>,
) {
  if (
    String(route.preparation_assignee_id || "") === userId ||
    String(route.delivery_assignee_id || "") === userId
  )
    return true;
  return (route.delivery_route_dispatches || []).some((link: any) => {
    const dispatch = Array.isArray(link.dispatches)
      ? link.dispatches[0]
      : link.dispatches;
    const installation = Array.isArray(dispatch?.installations)
      ? dispatch.installations[0]
      : dispatch?.installations;
    return installationIds.has(String(installation?.id || ""));
  });
}
