"use server";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function requestPasswordReset(formData:FormData){
  const email=String(formData.get("email")||"").trim().toLowerCase();
  if(!email)redirect("/forgot-password?error=Ingresa%20tu%20correo");
  const supabase=await createClient();
  const h=await headers();
  const origin=h.get("origin")||`${h.get("x-forwarded-proto")||"https"}://${h.get("x-forwarded-host")||h.get("host")}`;
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${origin}/reset-password`});
  if(error)redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  redirect("/forgot-password?sent=1");
}
