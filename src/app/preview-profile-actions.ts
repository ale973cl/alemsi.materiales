"use server";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["Admin Total", "Gerencia", "Admin", "Finanzas", "Bodega", "Supervisora"] as const;
const COOKIE_NAME = "alemsi_preview_origin";
const ACTIVE_COOKIE = "alemsi_preview_active";
const MAX_AGE_SECONDS = 60 * 60 * 6;

function ensurePreview() {
  if (process.env.VERCEL_ENV === "production") throw new Error("El cambio rápido de perfil está deshabilitado en Production");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error("Falta configuración privada para el modo Preview");
}

function secret() {
  return process.env.SUPABASE_SECRET_KEY || "";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function encodeOrigin(payload: { adminId: string; exp: number }) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeOrigin(value: string | undefined) {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.adminId || Number(payload.exp || 0) < Date.now()) return null;
    return payload as { adminId: string; exp: number };
  } catch {
    return null;
  }
}

function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInAsEmail(email: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) throw new Error(error?.message || "No se pudo generar la sesión de prueba");
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (verifyError) throw new Error(verifyError.message);
}

export async function switchPreviewProfile(formData: FormData) {
  ensurePreview();
  const role = String(formData.get("role") || "").trim();
  if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) throw new Error("Perfil no válido");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: current } = await supabase.from("user_profiles").select("id,role,active,email").eq("id", user.id).single();
  if (!current?.active || current.role !== "Admin Total") throw new Error("Solo Admin Total puede iniciar el modo de prueba por perfiles");

  const admin = adminClient();
  const { data: targets, error } = await admin.from("user_profiles").select("id,email,role,active,full_name").eq("role", role).eq("active", true).order("created_at", { ascending: true }).limit(1);
  if (error) throw new Error(error.message);
  const target = targets?.[0];
  if (!target?.email) throw new Error(`No existe un usuario activo con perfil ${role}`);

  const jar = await cookies();
  jar.set(COOKIE_NAME, encodeOrigin({ adminId: current.id, exp: Date.now() + MAX_AGE_SECONDS * 1000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  jar.set(ACTIVE_COOKIE, "1", {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });

  await signInAsEmail(target.email);
  redirect("/");
}

export async function returnFromPreviewProfile() {
  ensurePreview();
  const jar = await cookies();
  const origin = decodeOrigin(jar.get(COOKIE_NAME)?.value);
  if (!origin) throw new Error("La sesión de prueba expiró. Ingresa nuevamente como Admin Total.");

  const admin = adminClient();
  const { data: profile, error } = await admin.from("user_profiles").select("id,email,role,active").eq("id", origin.adminId).single();
  if (error || !profile?.active || profile.role !== "Admin Total" || !profile.email) throw new Error("No se pudo recuperar el usuario Admin Total");

  await signInAsEmail(profile.email);
  jar.delete(COOKIE_NAME);
  jar.delete(ACTIVE_COOKIE);
  redirect("/");
}
