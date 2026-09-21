# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `feat/servicios-adicionales-base`
- **Último commit:** este commit — `feat: iniciar modulo aislado de rendiciones`.
- **Base de rama:** `44bf934a7d2b66bc104bd8eb0100a07e2ff3a213` desde `fix/roles-oficiales-y-permisos`; no se usó el tronco antiguo `work/maestros-unificados-ui` para no perder cambios recientes.
- **Fecha de última actualización:** 2026-09-21

## Última tarea completada
- **Qué se hizo:** además de la base común, se creó Rendiciones v1 aislado: expediente, gastos, saldo histórico, tokens, RLS por creador/Finanzas/Gerencia, ruta `/rendiciones`, acciones para crear/agregar gasto/enviar y notificación por el motor central. Rendiciones sigue INACTIVO hasta habilitar usuarios.
- **Supabase:** migraciones `additional_services_base` y `additional_services_security_indexes` aplicadas correctamente. Tablas nuevas: `additional_services` y `additional_service_user_access`. Se revocó acceso anónimo a la función de autorización y se agregaron índices a las nuevas FK. No se modificaron tablas operacionales de Materiales.
- **Archivos tocados:** `supabase/migrations/20260921053000_additional_services_base.sql`, `supabase/migrations/20260921055500_additional_services_security_indexes.sql`, `src/lib/additional-services.ts`, `STATE.md`.
- **Correo:** Rendiciones usa `email_queue` y el motor central existente. `email-delivery.ts` fue corregido para usar exclusivamente `SUPABASE_SERVICE_ROLE_KEY`.
- **Build y tsc:** pendientes de validación después de integrar esta primera ruta ejecutable.

## Siguiente paso
- Validar Preview de `/rendiciones`, activar Rendiciones solo para usuarios de prueba y completar revisión Finanzas/Gerencia.
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
