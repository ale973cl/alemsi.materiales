import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const navy = rgb(0.04, 0.18, 0.29);
const teal = rgb(0.36, 0.68, 0.64);
const line = rgb(0.78, 0.86, 0.91);
const safe = (value: unknown) => String(value ?? "—").replace(/[\r\n]+/g, " ");
const money = (value: unknown) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export async function generatePurchaseOrderPdf(order: any) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const supplier = Array.isArray(order.suppliers)
    ? order.suppliers[0]
    : order.suppliers;
  const rows = order.purchase_order_lines || [];
  let page = pdf.addPage([612, 792]);
  let y = 748;
  const drawHeader = () => {
    page.drawText("ALEMSI", { x: 36, y, size: 22, font: bold, color: navy });
    page.drawText("ORDEN DE COMPRA", {
      x: 356,
      y: y + 2,
      size: 17,
      font: bold,
      color: navy,
    });
    page.drawText(safe(order.order_number || order.id), {
      x: 356,
      y: y - 17,
      size: 10,
      font: bold,
      color: teal,
    });
    y -= 45;
    page.drawLine({
      start: { x: 36, y },
      end: { x: 576, y },
      thickness: 1.5,
      color: teal,
    });
    y -= 20;
    page.drawText(`Proveedor: ${safe(supplier?.legal_name)}`, {
      x: 36,
      y,
      size: 9,
      font: bold,
      color: navy,
    });
    page.drawText(`RUT: ${safe(supplier?.rut)}`, {
      x: 330,
      y,
      size: 9,
      font: regular,
      color: navy,
    });
    y -= 15;
    page.drawText(`Pago: ${safe(order.payment_terms)}`, {
      x: 36,
      y,
      size: 8,
      font: regular,
      color: navy,
    });
    page.drawText(`Entrega: ${safe(order.delivery_terms)}`, {
      x: 330,
      y,
      size: 8,
      font: regular,
      color: navy,
    });
    y -= 24;
    page.drawRectangle({
      x: 36,
      y: y - 16,
      width: 540,
      height: 20,
      color: rgb(0.92, 0.96, 0.96),
    });
    page.drawText("Código", {
      x: 42,
      y: y - 10,
      size: 7,
      font: bold,
      color: navy,
    });
    page.drawText("Descripción", {
      x: 110,
      y: y - 10,
      size: 7,
      font: bold,
      color: navy,
    });
    page.drawText("Cant.", {
      x: 390,
      y: y - 10,
      size: 7,
      font: bold,
      color: navy,
    });
    page.drawText("Neto unit.", {
      x: 438,
      y: y - 10,
      size: 7,
      font: bold,
      color: navy,
    });
    page.drawText("Neto línea", {
      x: 515,
      y: y - 10,
      size: 7,
      font: bold,
      color: navy,
    });
    y -= 28;
  };
  drawHeader();
  for (const row of rows) {
    if (y < 90) {
      page = pdf.addPage([612, 792]);
      y = 748;
      drawHeader();
    }
    const material = Array.isArray(row.materials)
      ? row.materials[0]
      : row.materials;
    page.drawText(
      safe(row.supplier_code || material?.supplier_code).slice(0, 13),
      { x: 42, y, size: 7, font: regular, color: navy },
    );
    page.drawText(
      safe(row.description || material?.name || "Concepto").slice(0, 56),
      { x: 110, y, size: 7, font: regular, color: navy },
    );
    page.drawText(safe(row.ordered_qty), {
      x: 395,
      y,
      size: 7,
      font: regular,
      color: navy,
    });
    page.drawText(money(row.unit_net_price), {
      x: 438,
      y,
      size: 7,
      font: regular,
      color: navy,
    });
    page.drawText(money(row.line_net), {
      x: 515,
      y,
      size: 7,
      font: regular,
      color: navy,
    });
    y -= 17;
    page.drawLine({
      start: { x: 36, y: y + 5 },
      end: { x: 576, y: y + 5 },
      thickness: 0.4,
      color: line,
    });
  }
  y -= 8;
  page.drawText(`Neto: ${money(order.total_net)}`, {
    x: 420,
    y,
    size: 9,
    font: bold,
    color: navy,
  });
  y -= 15;
  page.drawText(`IVA: ${money(order.vat_amount)}`, {
    x: 420,
    y,
    size: 9,
    font: regular,
    color: navy,
  });
  y -= 17;
  page.drawText(`Total: ${money(order.total_amount)}`, {
    x: 420,
    y,
    size: 11,
    font: bold,
    color: navy,
  });
  if (order.conditions || order.observations) {
    y -= 28;
    page.drawText("Condiciones / observaciones", {
      x: 36,
      y,
      size: 8,
      font: bold,
      color: navy,
    });
    y -= 14;
    page.drawText(
      safe(
        [order.conditions, order.observations].filter(Boolean).join(" · "),
      ).slice(0, 110),
      { x: 36, y, size: 7, font: regular, color: navy },
    );
  }
  return Buffer.from(await pdf.save());
}
