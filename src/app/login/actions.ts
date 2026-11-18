"use server";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ROLE_ALIASES: Record<string, string> = {
  "admin total": "Admin Total",
  gerencia: "Gerencia",
  admin: "Admin",
  finanzas: "Finanzas",
  operaciones: "Operaciones",
  bodega: "Bodega",
  supervisora: "Supervisora",
};

function normalizeIdentifier(value: string) {
  return value.trim().toLocaleLowerCase("es-CL").replace(/\s+/g, " ");
}

async function resolveLoginEmail(identifier: string) {
  const value = identifier.trim();
  if (value.includes("@")) return value;

  const role = ROLE_ALIASES[normalizeIdentifier(value)];
  if (!role) return { error: "Correo o perfil no reconocido" } as const;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return { error: "Configuración de acceso no disponible" } as const;
  }

  const admin = createAdminClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("user_profiles")
    .select("email")
    .eq("role", role)
    .eq("active", true);

  if (error) return { error: "No se pudo validar el perfil" } as const;

  const profiles = (data || []).filter((profile) => String(profile.email || "").trim());
  if (profiles.length === 0) {
    return { error: "No existe un usuario activo para este perfil" } as const;
  }
  if (profiles.length > 1) {
    return { error: "Este perfil tiene más de un usuario activo. Ingresa con tu correo." } as const;
  }

  return String(profiles[0].email).trim();
}

export async function login(formData: FormData) {
  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");
  if (!identifier || !password) redirect("/login?error=Complete%20correo%20o%20perfil%20y%20contraseña");

  const resolved = await resolveLoginEmail(identifier);
  if (typeof resolved !== "string") {
    redirect(`/login?error=${encodeURIComponent(resolved.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: resolved, password });
  if (error) {
    const message = process.env.VERCEL_ENV === "production"
      ? "Credenciales inválidas o usuario inactivo"
      : `Supabase Auth: ${error.message}`;
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  redirect("/");
}

/** Preview-only passwordless sign-in for an existing ALEMSI user. No bypass of Auth/RLS. */
export async function requestPreviewTestCode(formData: FormData) {
  if (process.env.VERCEL_ENV !== "preview") redirect("/login");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/login?error=Ingresa%20un%20correo%20v%C3%A1lido");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) redirect(`/login?error=${encodeURIComponent("No fue posible enviar el código. Verifica que el usuario exista y que el correo esté habilitado.")}`);
  redirect(`/login?test_code=1&email=${encodeURIComponent(email)}`);
}

export async function verifyPreviewTestCode(formData: FormData) {
  if (process.env.VERCEL_ENV !== "preview") redirect("/login");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const token = String(formData.get("token") || "").trim();
  if (!email || !/^\d{6,8}$/.test(token)) redirect(`/login?test_code=1&email=${encodeURIComponent(email)}&error=C%C3%B3digo%20inv%C3%A1lido`);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) redirect(`/login?test_code=1&email=${encodeURIComponent(email)}&error=C%C3%B3digo%20incorrecto%20o%20vencido`);
  redirect("/");
}
