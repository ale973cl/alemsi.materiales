import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOperationalScope, routeIsInScope } from "@/lib/operational-scope";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();
  if (!profile?.active)
    return NextResponse.json({ error: "Usuario inactivo" }, { status: 403 });
  const scope = await getOperationalScope(supabase, user.id, profile.role);
  if (!scope.canAccessRoutes)
    return NextResponse.json({ error: "Sin acceso a rutas" }, { status: 403 });
  const { data, error } = await supabase
    .from("delivery_routes")
    .select(
      "id,route_name,planned_date,status,preparation_assignee_id,delivery_assignee_id,created_at,preparation_assignee:user_profiles!delivery_routes_preparation_assignee_id_fkey(id,full_name,email),delivery_assignee:user_profiles!delivery_routes_delivery_assignee_id_fkey(id,full_name,email),creator:user_profiles!delivery_routes_created_by_fkey(id,full_name,email),prepared_by_profile:user_profiles!delivery_routes_prepared_by_fkey(id,full_name,email),started_by_profile:user_profiles!delivery_routes_started_by_fkey(id,full_name,email),delivery_route_dispatches(id,dispatch_id,delivery_order,load_order,dispatches(id,status,internal_number,guide_number,observations,installations(id,name,address,region,city,commune),dispatch_lines(id,material_id,required_qty,delivered_qty,pending_qty,materials(id,name,family,presentation,unit,supplier_code))))",
    )
    .order("planned_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  const routes = scope.unrestricted
    ? data || []
    : (data || []).filter((route) =>
        routeIsInScope(route, user.id, scope.installationIds),
      );
  return NextResponse.json({ routes });
}
