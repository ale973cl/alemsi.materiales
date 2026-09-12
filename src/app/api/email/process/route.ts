import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderEmail, type EmailModule } from "@/lib/email-engine";
import { enviarCorreoSmtp } from "@/lib/email-smtp";

export async function POST(request: Request) {
  if (
    !process.env.EMAIL_WORKER_TOKEN ||
    request.headers.get("authorization") !== `Bearer ${process.env.EMAIL_WORKER_TOKEN}`
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (
    !process.env.SUPABASE_SECRET_KEY ||
    !process.env.SMTP_SERVER ||
    !process.env.SMTP_PORT ||
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS
  ) {
    return NextResponse.json(
      { error: "Faltan variables privadas del motor de correo SMTP" },
      { status: 503 },
    );
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } },
  );

  const { data: queue, error } = await db
    .from("email_queue")
    .select("*")
    .eq("status", "Pendiente")
    .lt("attempts", 5)
    .order("created_at")
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];

  for (const item of queue || []) {
    const payload: any = item.payload || {};
    const module = (item.module || payload.module || "alerts") as EmailModule;
    const event = String(item.event_code || payload.event || item.email_type || "notification");
    const summary = payload.summary || "Existe una actualización en el proceso de materiales.";
    const html = renderEmail({
      module,
      event,
      title: item.subject,
      summary,
      facts: payload.facts || {},
      actionUrl: payload.action_url || null,
    });

    const delivery = await enviarCorreoSmtp({
      to: item.to_addresses,
      cc: item.cc_addresses || [],
      subject: item.subject,
      text: summary,
      html,
    });

    const attempts = Number(item.attempts || 0) + 1;

    if (delivery.ok) {
      await db
        .from("email_queue")
        .update({
          status: "Enviado",
          attempts,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", item.id);

      await db.from("email_events").insert({
        email_queue_id: item.id,
        event_type: "sent",
        provider_message_id: null,
        detail: { module, event, provider: "smtp", status: delivery.status },
      });
    } else {
      const status = attempts >= 5 ? "Fallido" : "Pendiente";
      const lastError = `SMTP ${delivery.errorType}`;

      await db
        .from("email_queue")
        .update({ status, attempts, last_error: lastError })
        .eq("id", item.id);

      await db.from("email_events").insert({
        email_queue_id: item.id,
        event_type: "failed",
        provider_message_id: null,
        detail: { module, event, provider: "smtp", status: lastError },
      });
    }

    results.push({
      id: item.id,
      ok: delivery.ok,
      status: delivery.ok ? "Enviado" : attempts >= 5 ? "Fallido" : "Pendiente",
    });
  }

  return NextResponse.json({ processed: results.length, results });
}
