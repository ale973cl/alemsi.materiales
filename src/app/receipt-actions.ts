"use server";
import { CAPABILITIES, rolesFor } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function ctx(roles: readonly string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no válida");
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role,active,full_name,email")
    .eq("id", user.id)
    .single();
  if (!profile?.active || !roles.includes(profile.role))
    throw new Error("No autorizado para esta operación");
  return { supabase, user, profile };
}

export async function registerPurchaseOrderReceipt(formData: FormData) {
  const { supabase, user, profile } = await ctx(
    rolesFor(CAPABILITIES.RECEIPT_REGISTER),
  );
  const purchaseOrderId = String(
    formData.get("purchase_order_id") || "",
  ).trim();
  const documentType = String(formData.get("document_type") || "").trim();
  const documentFolio = String(formData.get("document_folio") || "").trim();
  const documentDate = String(formData.get("document_date") || "").trim();
  const documentNet = Number(formData.get("document_net") || 0);
  const documentVat = Number(formData.get("document_vat") || 0);
  const documentTotal = Number(formData.get("document_total") || 0);
  const shippingCondition = String(
    formData.get("shipping_condition") || "Incluido",
  ).trim();
  const freightNet = Number(formData.get("freight_net") || 0);
  const observation = String(formData.get("observation") || "").trim() || null;
  const lines = JSON.parse(String(formData.get("lines") || "[]"));
  if (!purchaseOrderId) throw new Error("Selecciona una orden de compra");
  if (!["Factura", "Boleta", "Guía de despacho", "Otro"].includes(documentType))
    throw new Error("Selecciona el tipo de documento");
  if (!documentFolio) throw new Error("El folio del documento es obligatorio");
  if (!documentDate) throw new Error("La fecha del documento es obligatoria");
  if (
    !Array.isArray(lines) ||
    !lines.some((l: any) => Number(l.received_qty) > 0)
  )
    throw new Error("Ingresa al menos una cantidad recibida mayor a cero");
  if (shippingCondition === "Por pagar" && freightNet <= 0)
    throw new Error("Ingresa el valor neto del flete por pagar");
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select(
      "id,supplier_id,status,purchase_order_lines(id,material_id,ordered_qty)",
    )
    .eq("id", purchaseOrderId)
    .single();
  if (poError || !po) throw new Error("OC no encontrada");
  const validOrderLines = new Map(
    ((po as any).purchase_order_lines || []).map((line: any) => [
      String(line.id),
      line,
    ]),
  );
  const requestedLines = lines.filter(
    (line: any) => Number(line.received_qty) > 0,
  );
  if (
    requestedLines.some((line: any) => {
      const orderLine: any = validOrderLines.get(
        String(line.purchase_order_line_id),
      );
      return (
        !orderLine || String(orderLine.material_id) !== String(line.material_id)
      );
    })
  )
    throw new Error("Una o más líneas no pertenecen a la OC seleccionada");
  const { data: previousReceipts, error: previousError } = await supabase
    .from("receipt_lines")
    .select(
      "purchase_order_line_id,received_qty,receipts!inner(purchase_order_id)",
    )
    .eq("receipts.purchase_order_id", purchaseOrderId);
  if (previousError)
    throw new Error("No se pudo validar el saldo pendiente de la OC");
  const previouslyReceived = new Map<string, number>();
  for (const line of previousReceipts || []) {
    const id = String((line as any).purchase_order_line_id || "");
    previouslyReceived.set(
      id,
      (previouslyReceived.get(id) || 0) +
        Number((line as any).received_qty || 0),
    );
  }
  for (const line of requestedLines) {
    const orderLine: any = validOrderLines.get(
      String(line.purchase_order_line_id),
    );
    const pending = Math.max(
      Number(orderLine.ordered_qty || 0) -
        (previouslyReceived.get(String(orderLine.id)) || 0),
      0,
    );
    if (Number(line.received_qty) > pending)
      throw new Error(
        `La cantidad recibida supera el saldo pendiente de una línea de la OC`,
      );
  }
  const { data: duplicate } = await supabase
    .from("receipts")
    .select("id")
    .eq("supplier_id", po.supplier_id)
    .eq("document_type", documentType)
    .eq("document_folio", documentFolio)
    .limit(1)
    .maybeSingle();
  if (duplicate)
    throw new Error("Este documento ya fue registrado para el proveedor");
  const { data: receipt, error } = await supabase
    .from("receipts")
    .insert({
      purchase_order_id: purchaseOrderId,
      supplier_id: po.supplier_id,
      invoice_number: documentType === "Factura" ? documentFolio : null,
      invoice_date: documentDate,
      invoice_net: documentNet,
      vat_amount: documentVat,
      status: "Pendiente cotejo",
      received_by: user.id,
      received_at: new Date().toISOString(),
      shipping_condition: shippingCondition,
      freight_net: shippingCondition === "Por pagar" ? freightNet : 0,
      document_type: documentType,
      document_folio: documentFolio,
      document_date: documentDate,
      document_net: documentNet,
      document_total: documentTotal,
      reconciliation_status: "Pendiente cotejo",
      inventory_posted: false,
    })
    .select("id")
    .single();
  if (error || !receipt)
    throw new Error(error?.message || "No se pudo registrar el documento");
  const lineRows = lines
    .filter((l: any) => Number(l.received_qty) > 0)
    .map((l: any) => ({
      receipt_id: receipt.id,
      purchase_order_line_id: l.purchase_order_line_id,
      material_id: l.material_id,
      received_qty: Number(l.received_qty),
      actual_unit_net: Number(l.actual_unit_net || 0),
      line_net: Number(l.received_qty) * Number(l.actual_unit_net || 0),
      difference_note: null,
    }));
  const { error: lineError } = await supabase
    .from("receipt_lines")
    .insert(lineRows);
  if (lineError) {
    await supabase.from("receipts").delete().eq("id", receipt.id);
    throw new Error(lineError.message);
  }
  for (const line of requestedLines) {
    const id = String(line.purchase_order_line_id);
    previouslyReceived.set(
      id,
      (previouslyReceived.get(id) || 0) + Number(line.received_qty || 0),
    );
  }
  const allFulfilled = [...validOrderLines.values()].every(
    (line: any) =>
      (previouslyReceived.get(String(line.id)) || 0) >=
      Number(line.ordered_qty || 0),
  );
  const orderStatus = allFulfilled ? "Recibida" : "Recepción parcial";
  const { error: statusError } = await supabase
    .from("purchase_orders")
    .update({ status: orderStatus })
    .eq("id", purchaseOrderId);
  if (statusError) {
    await supabase.from("receipt_lines").delete().eq("receipt_id", receipt.id);
    await supabase.from("receipts").delete().eq("id", receipt.id);
    throw new Error(
      "La recepción no se guardó porque no fue posible actualizar el cumplimiento de la OC",
    );
  }
  await supabase.from("activity_log").insert({
    actor_id: user.id,
    actor_name: profile.full_name || profile.email,
    module: "Recepción",
    action: "Registrar documento para cotejo",
    entity_table: "receipts",
    entity_id: receipt.id,
    new_data: {
      purchase_order_id: purchaseOrderId,
      document_type: documentType,
      document_folio: documentFolio,
      document_date: documentDate,
      document_net: documentNet,
      document_total: documentTotal,
      purchase_order_status: orderStatus,
    },
    observation,
  });
  revalidatePath("/");
  return { ok: true, id: receipt.id };
}
