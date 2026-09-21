# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `feat/servicios-adicionales-base`
- **Último commit:** este commit — `feat: crear base aislada de servicios adicionales`.
- **Base de rama:** `44bf934a7d2b66bc104bd8eb0100a07e2ff3a213` desde `fix/roles-oficiales-y-permisos`; no se usó el tronco antiguo `work/maestros-unificados-ui` para no perder cambios recientes.
- **Fecha de última actualización:** 2026-09-21

## Última tarea completada
- **Qué se hizo:** se creó la base genérica y aislada para servicios adicionales. Estados comerciales: INACTIVO/DEMO/ACTIVO. Admin Total administra activación y autorizaciones. Rendiciones queda con acceso individual autorizado; Flota permite uso a cualquier usuario autenticado cuando el servicio está activo; Cotizaciones queda preparado pero INACTIVO. Se creó función RLS `has_additional_service_access`.
- **Supabase:** migración `additional_services_base` aplicada correctamente. Tablas nuevas: `additional_services` y `additional_service_user_access`. No se modificaron tablas operacionales de Materiales.
- **Archivos tocados:** `supabase/migrations/20260921053000_additional_services_base.sql`, `src/lib/additional-services.ts`, `STATE.md`.
- **Correo:** los nuevos módulos deben encolar notificaciones en `email_queue` y usar el motor central existente; no se crea un motor paralelo.
- **Build y tsc:** pendientes después de integrar la primera UI/ruta; este commit no altera componentes ni rutas ejecutables.

## Siguiente paso
- Crear persistencia aislada y primera ruta funcional de Rendiciones, consultando roles/permisos existentes y el estado del servicio.
- Después crear persistencia y primera ruta funcional de Control de Flota, incluyendo QR por vehículo.
- Mantener Cotizaciones INACTIVO hasta cerrar su definición funcional.
- Antes de conectar notificaciones nuevas, corregir el uso legacy de `SUPABASE_SECRET_KEY` en el motor central a `SUPABASE_SERVICE_ROLE_KEY` en una tarea separada y validada.

## Pendientes conocidos
- [ ] Rendiciones: tablas/RLS propias, creación, revisión Finanzas/Gerencia, saldo histórico por RUT, token y reportes.
- [ ] Flota: vehículos, QR, usos, fotos, incidentes, seguro/asistencia, mantenciones y alertas.
- [ ] Cotizaciones: cerrar permisos y flujo antes de implementar.
- [ ] Validar Preview y ejecutar `npm run build` + `npx tsc --noEmit` cuando exista integración UI.
- [ ] Retomar pendientes previos de Levantamientos/permisos desde la rama base sin perderlos.

## Circuitos de Materiales que no deben alterarse
1. Campaña: instalación en campaña Abierta queda bloqueada para otra hasta cierre.
2. Levantamiento: carencia = máximo autorizado − remanente, limitada a cero.
3. Abastecimiento → OC: presupuesto alerta, nunca bloquea.
4. Recepción → Inventario → Despacho → Guía/Entrega mantiene trazabilidad.
5. Respaldos solo Admin Total.
6. Roles y navegación continúan usando la estructura oficial existente.
