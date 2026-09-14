import PreviewProfileSwitcher from "@/components/PreviewProfileSwitcher";
import { createClient } from "@/lib/supabase/server";

export default async function PreviewProfileAccess() {
  if (process.env.VERCEL_ENV === "production") return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id,role,active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active) return null;

  let users:any[] = [];
  if (profile.role === "Admin Total") {
    const { data } = await supabase
      .from("user_profiles")
      .select("id,full_name,email,role,active")
      .eq("active", true)
      .order("role");
    users = data || [];
  }

  return <div style={{padding:"12px 18px 0",maxWidth:1500,margin:"0 auto"}}>
    <PreviewProfileSwitcher currentRole={profile.role} users={users}/>
  </div>;
}
