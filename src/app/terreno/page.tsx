import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import FieldDispatch from "@/components/modules/FieldDispatch";
export default async function TerrenoPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const {data:profile}=await supabase.from("user_profiles").select("id,full_name,role,active").eq("id",user.id).maybeSingle();
 if(!profile?.active)redirect("/");
 return <FieldDispatch userId={user.id} operatorName={profile.full_name||"Operador"}/>;
}
