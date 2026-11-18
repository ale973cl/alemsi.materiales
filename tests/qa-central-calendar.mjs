import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, santiagoDate, evaluateCalendarEvent, buildCentralCalendar } from '../src/lib/central-calendar.ts';
import { fleetCalendarEvents } from '../src/lib/fleet-calendar.ts';

const threshold = { days: 7, km: 1000 };
const thresholds = Object.fromEntries(['compras', 'rendiciones', 'flota', 'campanas', 'documentos'].map(id => [id, threshold]));
const event = { module: 'flota', sourceId: 'vehicle-document-1', kind: 'poliza', title: 'Póliza' };
const evaluate = (value) => evaluateCalendarEvent({ ...event, ...value }, threshold, '2026-11-17');

test('días calendario en cambios de mes, año bisiesto y horario de verano', () => {
  assert.equal(daysUntil('2027-01-01', '2026-12-31'), 1);
  assert.equal(daysUntil('2024-03-01', '2024-02-28'), 2);
  assert.equal(daysUntil('2026-09-07', '2026-09-05'), 2);
});
test('fecha de Chile antes de medianoche aunque UTC ya cambió de día', () => {
  assert.equal(santiagoDate(new Date('2026-11-18T01:00:00Z')), '2026-11-17');
});
test('rechaza fechas inexistentes, formatos ambiguos y umbrales inválidos', () => {
  for (const dueDate of ['2026-02-29', '2026-04-31', '17/11/2026']) assert.throws(() => evaluate({ dueDate }));
  assert.throws(() => evaluateCalendarEvent(event, { days: -1, km: 10 }, '2026-11-17'));
});
test('distingue vencido, hoy, umbral y vigente', () => {
  for (const [dueDate, state] of [['2026-11-16', 'vencido'], ['2026-11-17', 'hoy'], ['2026-11-24', 'proximo'], ['2026-11-25', 'vigente']]) {
    assert.equal(evaluate({ dueDate }).state, state);
  }
});
test('kilometraje cero es conocido; kilometraje ausente no se inventa', () => {
  assert.equal(evaluate({ targetKm: 1000, currentKm: 0 }).kmRemaining, 1000);
  assert.equal(evaluate({ targetKm: 1000 }).kmRemaining, null);
  assert.equal(evaluate({}).state, 'sin_datos');
  for (const currentKm of [-1, Infinity, NaN, 1.5]) assert.throws(() => evaluate({ targetKm: 1000, currentKm }));
});
test('fecha y km disparan la alerta por el límite que vence primero', () => {
  assert.equal(evaluate({ dueDate: '2027-01-01', targetKm: 10000, currentKm: 10500 }).state, 'vencido');
  assert.equal(evaluate({ dueDate: '2026-11-17', targetKm: 10000, currentKm: 2000 }).state, 'hoy');
  assert.equal(evaluate({ targetKm: 10000, currentKm: 9200 }).kmRemaining, 800);
});
test('excluye obligaciones resueltas y detecta orígenes duplicados', () => {
  assert.deepEqual(buildCentralCalendar([{ ...event, resolved: true }], thresholds, '2026-11-17'), []);
  assert.throws(() => buildCentralCalendar([event, event], thresholds, '2026-11-17'));
  assert.equal(buildCentralCalendar([event, { ...event, module: 'documentos' }], thresholds, '2026-11-17').length, 2);
});
test('ordena prioridades sin comparar días con kilómetros', () => {
  const alerts = buildCentralCalendar([
    { ...event, sourceId: 'future', dueDate: '2027-01-01' },
    { ...event, sourceId: 'overdue', currentKm: 11000, targetKm: 10000 },
    { ...event, sourceId: 'missing' },
  ], thresholds, '2026-11-17');
  assert.deepEqual(alerts.map(row => row.sourceId), ['overdue', 'future', 'missing']);
});
test('flota conserva solo documentos actuales y no estima fechas desde km', () => {
  const events = fleetCalendarEvents([
    { id: 'old', vehicle_id: 'v1', kind: 'SOAP', is_current: false, expires_at: '2025-01-01' },
    { id: 'current', vehicle_id: 'v1', kind: 'SOAP', is_current: true, expires_at: '2027-01-01' },
  ], [{ id: 'oil', vehicle_id: 'v1', activity: 'Aceite', next_date: null, next_km: 20000 }], new Map([['v1', 19200]]));
  const alerts = buildCentralCalendar(events, thresholds, '2026-11-17');
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].sourceId, 'oil');
  assert.equal(alerts[0].daysRemaining, null);
  assert.equal(alerts[0].kmRemaining, 800);
});

test('facturas pagadas y revertidas no generan alertas', async () => {
  const { payableCalendarEvents } = await import('../src/lib/payable-calendar.ts');
  const base = { id: 'f1', documentType: 'factura', folio: '123', supplierName: 'Proveedor', dueDate: '2026-11-20', totalCents: 10000, creditedCents: 0 };
  const events = payableCalendarEvents([base, { ...base, id: 'f2', creditedCents: 10000 }, { ...base, id: 'f3', reversed: true }]);
  assert.equal(events.length, 1);
  assert.equal(buildCentralCalendar(events, thresholds, '2026-11-17')[0].state, 'proximo');
});
test('factura parcialmente abonada conserva alerta y fecha', async () => {
  const { payableCalendarEvents } = await import('../src/lib/payable-calendar.ts');
  const events = payableCalendarEvents([{ id: 'f1', documentType: 'factura', folio: '5', supplierName: 'Proveedor', dueDate: '2026-11-16', totalCents: 10000, creditedCents: 4000 }]);
  assert.equal(buildCentralCalendar(events, thresholds, '2026-11-17')[0].state, 'vencido');
});
test('facturas duplicadas, importes inválidos y sobrepagos se rechazan', async () => {
  const { payableCalendarEvents } = await import('../src/lib/payable-calendar.ts');
  const base = { id: 'f1', documentType: 'factura', folio: '123', supplierName: 'Proveedor', dueDate: null, totalCents: 10000, creditedCents: 0 };
  assert.throws(() => payableCalendarEvents([base, base]));
  for (const amount of [-1, 10001, 1.5, Infinity]) {
    assert.throws(() => payableCalendarEvents([{ ...base, creditedCents: amount }]));
  }
});
