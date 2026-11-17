import type { CalendarEvent } from './central-calendar';

export type FleetDocument = {
  id: string; vehicle_id: string; kind: string; is_current: boolean; expires_at: string | null;
};
export type FleetMaintenance = {
  id: string; vehicle_id: string; activity: string; next_date: string | null; next_km: number | null;
};

/** No DB access: only pass rows visible to the authorized user and current maintenance plans. */
export function fleetCalendarEvents(
  documents: FleetDocument[], currentPlans: FleetMaintenance[], vehicleKm: ReadonlyMap<string, number>,
): CalendarEvent[] {
  return [
    ...documents.filter(row => row.is_current).map(row => ({
      module: 'flota' as const, sourceId: row.id, kind: 'documento',
      title: row.kind, dueDate: row.expires_at,
    })),
    ...currentPlans.map(row => ({
      module: 'flota' as const, sourceId: row.id, kind: 'mantencion', title: row.activity,
      dueDate: row.next_date, targetKm: row.next_km, currentKm: vehicleKm.get(row.vehicle_id) ?? null,
    })),
  ];
}
