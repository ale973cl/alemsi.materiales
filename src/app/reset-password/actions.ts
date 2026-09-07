"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function updatePassword(formData:FormData){
  const password=String(formData.get("password")||"");
  const confirm=String(formData.get("confirm_password")||"");
  if(password.length<8)redirect("/reset-password?error=La%20contraseña%20debe%20tener%20al%20menos%208%20caracteres");
  if(password!==confirm)redirect("/reset-password?error=Las%20contraseñas%20no%20coinciden");
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/forgot-password?error=El%20enlace%20de%20recuperación%20no%20es%20válido%20o%20expiró");
  const {error}=await supabase.auth.updateUser({password});
  if(error)redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}
