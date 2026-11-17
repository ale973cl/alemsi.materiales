/** Shared, side-effect-free calendar. Callers must authorize and scope source rows. */
export type CalendarModule = 'compras' | 'rendiciones' | 'flota' | 'campanas' | 'documentos';
export type CalendarEvent = {
  module: CalendarModule;
  sourceId: string;
  kind: string;
  title: string;
  responsibleId?: string | null;
  dueDate?: string | null;
  targetKm?: number | null;
  currentKm?: number | null;
  resolved?: boolean;
};
export type AlertThreshold = { days: number; km: number };
export type AlertState = 'vencido' | 'hoy' | 'proximo' | 'vigente' | 'sin_datos';
export type CalendarAlert = CalendarEvent & {
  key: string;
  daysRemaining: number | null;
  kmRemaining: number | null;
  state: AlertState;
};

const DAY_MS = 86_400_000;
function dayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha inválida: usa AAAA-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Fecha inexistente');
  }
  return date.getTime() / DAY_MS;
}

export function santiagoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function daysUntil(dueDate: string, today: string): number {
  // Calendar days rather than elapsed 24-hour periods across DST changes.
  return dayNumber(dueDate) - dayNumber(today);
}

function validKm(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function evaluateCalendarEvent(
  event: CalendarEvent, threshold: AlertThreshold, today: string,
): CalendarAlert {
  dayNumber(today);
  if (!Number.isSafeInteger(threshold.days) || threshold.days < 0 ||
      !Number.isSafeInteger(threshold.km) || threshold.km < 0) {
    throw new Error('Umbrales inválidos');
  }
  if (!event.sourceId.trim() || !event.kind.trim()) throw new Error('Origen de evento obligatorio');
  const daysRemaining = event.dueDate ? daysUntil(event.dueDate, today) : null;
  for (const km of [event.targetKm, event.currentKm]) {
    if (km != null && !validKm(km)) throw new Error('Kilometraje inválido');
  }
  const kmRemaining = validKm(event.targetKm) && validKm(event.currentKm)
    ? event.targetKm - event.currentKm : null;
  let state: AlertState = 'sin_datos';
  if (daysRemaining !== null || kmRemaining !== null) {
    if ((daysRemaining !== null && daysRemaining < 0) || (kmRemaining !== null && kmRemaining < 0)) state = 'vencido';
    else if (daysRemaining === 0 || kmRemaining === 0) state = 'hoy';
    else if ((daysRemaining !== null && daysRemaining <= threshold.days) ||
             (kmRemaining !== null && kmRemaining <= threshold.km)) state = 'proximo';
    else state = 'vigente';
  }
  return { ...event, key: JSON.stringify([event.module, event.sourceId, event.kind]), daysRemaining, kmRemaining, state };
}

export function buildCentralCalendar(
  events: CalendarEvent[], thresholds: Record<CalendarModule, AlertThreshold>, today = santiagoDate(),
): CalendarAlert[] {
  const seen = new Set<string>();
  const alerts: CalendarAlert[] = [];
  for (const event of events) {
    if (event.resolved) continue;
    const alert = evaluateCalendarEvent(event, thresholds[event.module], today);
    if (seen.has(alert.key)) throw new Error('Evento duplicado en el calendario');
    seen.add(alert.key);
    alerts.push(alert);
  }
  const rank: Record<AlertState, number> = { vencido: 0, hoy: 1, proximo: 2, vigente: 3, sin_datos: 4 };
  return alerts.sort((a, b) => rank[a.state] - rank[b.state] ||
    (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity) || a.key.localeCompare(b.key));
}
