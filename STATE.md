# STATE — ALEMSI Materiales
## Estado actual
- **Rama activa:** ui/rendiciones-corporativa
- **Último cambio:** feedback inmediato de botones + galería inferior de comprobantes en Rendiciones.
- **Fecha:** 2026-09-21

## Última tarea completada
- Solo Rendiciones fue modificada.
- Admin Total, Finanzas y Gerencia comparten la visual completa de bandeja general.
- Los demás usuarios ven Nueva rendición + Mis rendiciones y solo sus registros.
- Cada línea abre /rendiciones/[id]; no se expande dentro de la bandeja.
- El expediente conserva comprobante, Gemini, autocompletado, edición, suma, envío y revisión.
- Gerencia conserva permisos actuales: puede observar; no aprobar/rechazar/pagar.
- Finanzas/Admin Total conservan aprobación/rechazo y pago según reglas actuales.
- Sin cambios de Supabase, esquema, Gemini, API, variables Vercel ni otros módulos.

## Siguiente paso
- Validar Preview en escritorio y Android.
- Probar usuario común y perfiles Admin Total/Finanzas/Gerencia.

## Pendientes conocidos
- [ ] Validación UX escritorio/Android.
- [ ] Circuito completo de observación y correo.
- [ ] Confirmar INACTIVO/DEMO/ACTIVO.
- [ ] Historial básico y saldo anterior por RUT.

## Circuitos que no deben alterarse
1. Campaña: bloqueo de instalación en campaña activa.
2. Carencia = máximo autorizado − remanente.
3. Presupuesto alerta, nunca bloquea.
4. Recepción → Inventario → Despacho → Entrega.
5. Respaldos solo Admin Total.
6. Roles oficiales se mantienen.

## Ajuste visual 2026-09-21
- Indicadores de estado ahora usan colores contrastados de la paleta ALEMSI; error/rechazo conserva rojo funcional.
- Botones de Rendiciones pasan de píldora a rectangulares con radio moderado y borde visible.
- Ver comprobante, Volver y acciones secundarias se diferencian del fondo mediante borde teal y fondo claro.
- Sin cambios de lógica, permisos, Supabase, Gemini ni variables Vercel.

## Ajuste Rendiciones 2026-09-22
- La lista de gastos permanece arriba con su detalle operativo.
- Los comprobantes se muestran juntos en una galería inferior; las imágenes se amplían en pantalla y los PDF conservan apertura directa.
- Las acciones de Rendiciones muestran texto de proceso (Guardando…, Enviando…, Aprobando…, etc.) y se bloquean mientras ejecutan para evitar doble clic.
- No se usa spinner/rombo en estos botones.
- Sin cambios de esquema Supabase, Gemini, permisos ni variables Vercel.
