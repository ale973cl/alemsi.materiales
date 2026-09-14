import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ enabled: false });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ enabled: true, authenticated: false });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id,full_name,email,role,active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active) {
    return NextResponse.json({ enabled: true, authenticated: true, profile: null, users: [] });
  }

  let users: any[] = [];
  if (profile.role === "Admin Total") {
    const { data } = await supabase
      .from("user_profiles")
      .select("id,full_name,email,role,active")
      .order("full_name", { ascending: true });
    users = data || [];
  }

  return NextResponse.json({
    enabled: true,
    authenticated: true,
    profile,
    users,
  });
}
