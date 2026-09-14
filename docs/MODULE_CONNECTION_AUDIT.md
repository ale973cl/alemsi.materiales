# Auditoría de conexión de módulos

Rama auditada: `fix/conexion-y-limpieza-modulos`.

## roleModules y render real

- Admin Total: inicio (inline), maestros (`MastersModule`), campañas (`CampaignsModule`), levantamientos (`SurveyCampaignSelector`), abastecimiento (`ConsolidatedSupplyModule`), oc (`PurchaseOrdersModule`), finanzas (`FinanceInvoicesModule`), recepcion (`ConnectedReceiptModule`), despacho (`DispatchDeliveryModule`), pendientes (inline), correos (inline), auditoria (inline), respaldos (`BackupModule`).
- Gerencia: inicio, maestros, campañas, levantamientos, abastecimiento, oc, finanzas, recepcion, despacho, pendientes, correos y auditoria; todos tienen render propio o inline explícito.
- Admin: inicio, maestros, campañas, levantamientos, abastecimiento, oc, recepcion, despacho, pendientes y correos; todos tienen render propio o inline explícito.
- Finanzas: inicio, maestros, abastecimiento, oc, finanzas, recepcion, pendientes y correos; todos tienen render propio o inline explícito.
- Bodega: inicio, maestros, recepcion, despacho y pendientes; todos tienen render propio o inline explícito.
- Supervisora: inicio, levantamientos y pendientes; todos tienen render propio o inline explícito.

Después de conectar `BackupModule`, ninguna pestaña declarada en `roleModules` cae en `ModuleInfo`. No se conectó ningún otro módulo durante esta auditoría.

## Verificación automatizada temporal

La rama incluye temporalmente `.github/workflows/fix-connection-audit.yml` para obtener evidencia reproducible de referencias, variables `process.env`, `npm run build` y `npx tsc --noEmit`. El workflow está restringido a esta rama de corrección y se retirará en la tarea final de verificación para no dejar infraestructura temporal en la rama que se revise para integración.
