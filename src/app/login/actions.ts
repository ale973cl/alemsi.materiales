"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PROFILE_EMAIL_ENV: Record<string, string> = {
  gerencia: "LOGIN_GERENCIA_EMAIL",
};

function resolveLoginEmail(identifier: string) {
  const value = identifier.trim();
  if (value.includes("@")) return value;

  const alias = value.toLocaleLowerCase("es-CL");
  const envName = PROFILE_EMAIL_ENV[alias];
  if (!envName) return null;

  const configuredEmail = String(process.env[envName] || "").trim();
  return configuredEmail || null;
}

export async function login(formData: FormData) {
  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");
  if (!identifier || !password) redirect("/login?error=Complete%20correo%20o%20perfil%20y%20contraseña");

  const email = resolveLoginEmail(identifier);
  if (!email) redirect("/login?error=Correo%20o%20perfil%20no%20reconocido");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const message = process.env.VERCEL_ENV === "production"
      ? "Credenciales inválidas o usuario inactivo"
      : `Supabase Auth: ${error.message}`;
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  redirect("/");
}
