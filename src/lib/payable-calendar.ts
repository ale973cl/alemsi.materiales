import type { CalendarEvent } from './central-calendar';

export type PayableCalendarSource = {
  id: string;
  documentType: string;
  folio: string;
  supplierName: string;
  dueDate: string | null;
  totalCents: number;
  creditedCents: number;
  reversed?: boolean;
  responsibleId?: string | null;
};

/**
 * Accept only already-authorized, canonical invoices and accredited (not merely
 * submitted) payments. Amounts use integer cents to avoid floating-point drift.
 * This adapter does not read Supabase or change financial balances.
 */
export function payableCalendarEvents(rows: readonly PayableCalendarSource[]): CalendarEvent[] {
  const seen = new Set<string>();
  const events: CalendarEvent[] = [];
  for (const row of rows) {
    if (!row.id.trim() || !row.documentType.trim() || !row.folio.trim()) {
      throw new Error('Identidad de factura incompleta');
    }
    if (!Number.isSafeInteger(row.totalCents) || row.totalCents < 0 ||
        !Number.isSafeInteger(row.creditedCents) || row.creditedCents < 0 ||
        row.creditedCents > row.totalCents) {
      throw new Error('Saldo financiero inválido');
    }
    if (seen.has(row.id)) throw new Error('Factura duplicada en fuente de calendario');
    seen.add(row.id);
    if (row.reversed || row.creditedCents === row.totalCents) continue;
    events.push({
      module: 'compras',
      sourceId: row.id,
      kind: 'factura_por_pagar',
      title: `${row.supplierName} · ${row.documentType} ${row.folio}`,
      responsibleId: row.responsibleId ?? null,
      dueDate: row.dueDate,
    });
  }
  return events;
}
