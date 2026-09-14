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

## Verificación de limpieza

Antes del borrado se buscó cada candidato legacy. Los archivos sin referencias reales se eliminaron en un commit independiente. Se conservaron `src/components/Common.tsx`, `src/lib/materiales-domain.ts` y `src/lib/materiales-store.ts` porque sí tenían referencias reales al momento de la auditoría, aunque fueran referencias del conjunto legacy; su eventual eliminación requiere decisión separada.

Tras la limpieza, el build de Next.js 15.5.25 compiló correctamente y el comando de verificación ejecutó también `npx tsc --noEmit` sin errores. La navegación de los seis roles se validó contra `roleModules` y contra las ramas de render de `OperationalApp.tsx`; ninguno de sus tabs depende de los archivos eliminados.
