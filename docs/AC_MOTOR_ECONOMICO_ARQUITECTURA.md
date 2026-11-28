# ALEMSI · Motor económico opcional y crédito de proveedores
**Versión técnica:** 2026-11-27 · Rama de prueba `feat/motor-economico-opcional-20261127` · NO autorizado para Production.

## Arquitectura y alcance verificado
- Fuente de cliente y contrato: `clients → contracts → installations`. Una campaña puede tener instalaciones de contratos diferentes y `campaigns.contract_id` ser NULL. Toda atribución contractual se determina desde la instalación real.
- Catálogo y costos: `materials.current_net_price` refleja CPP/reference vigente, sujeto a cambios de ficha. `receipt_lines.actual_unit_net` y `receipts.inventory_posted` permiten buscar último costo confirmado; no se equiparan con el CPP.
- Consolidado: `surveys → survey_lines` tiene `authorized_qty, physical_remainder, shortage_qty, unit_net_price, line_net`; `supply_runs / supply_lines` y `purchase_orders / purchase_order_lines` siguen intactos.
- Guías: `dispatches / dispatch_lines`, `create_dispatch_v1`, `transition_dispatch_v1` y `register_dispatch_delivery_v1` siguen siendo fuentes operativas. El marcador `CAMPAÑA:<uuid>` viene de `observations` y se valida contra `campaign_installations`.
- Finanzas existentes: `receipts,receipt_lines,suppliers.payment_terms,purchase_orders.payment_terms`, además de adaptadores puros `payable-calendar.ts` y `central-calendar.ts`. No existe recepción legal SII ni libro de pagos acreditados reutilizable en estas tablas.

## Migración aditiva (no aplicada a Supabase compartido)
`supabase/migrations/20261127220000_ac_motor_economico_opcional.sql`

1. `contracts.control_economico_activo BOOLEAN NOT NULL DEFAULT FALSE`, `frecuencia_ciclo_meses`, `dias_anticipacion_alerta`.
2. `ac_contrato_presupuesto_mensual(contrato_id,mes,techo_neto_clp)`, sin IVA ni salario/flete.
3. `ac_plantillas_curva_presupuesto` reutilizables; `ac_campana_periodo(campana_id,contrato_id,mes_inicio,mes_fin)`.
4. `dispatch_lines.costo_unitario_congelado_clp` y `ac_guia_imputacion_mensual` congelan valor al crear líneas en contratos habilitados; el ledger pondera mensualidad. Una guía extraordinaria se imputa al mes de creación.
5. `ac_devoluciones_materiales` asocia cada devolución a movimiento físico positivo del material y no deja reingresar más que la cantidad entregada.
6. `ac_factura_credito` y `ac_factura_pagos` conservan fecha SII, días de crédito y abonos acreditados con tope bruto por factura.
7. `ac_v_resumen_mensual` y `ac_v_facturas_vencimiento` vistas `security_invoker=true`, policies RLS y autorización por roles.

**Cero bloqueo:** Ningún nuevo campo es obligatorio para contratos previos. Si la activación está apagada, ninguna guía exige presupuesto. La UI oculta cálculos no verificables y la API GET devuelve modo no disponible cuando no existe migración. No se hacen mutaciones a datos reales en esta fase.

## Tipos / servicios puros
- `src/lib/ac-economic-engine.ts`: `monthRange,monthPlus,buildBudgetCurve,pasteExcelCurve,campaignBaseBudget,valueCampaign,allocateGuide,nextCycle`.
- `src/lib/ac-invoice-credit.ts`: `calculatePayable`, fechas corridas, ventana de ocho días y alerta a cinco días, usando fecha SII proporcionada.
- Los servicios devuelven `null`/error si falta CPP, último precio, meses o base monetaria; no substituyen información real por cero.

## Integración UI exacta
| Ubicación | Componente existente | Integración |
|---|---|---|
| `/` Inicio | `OperationsHome.tsx` | `AcOverviewWidget.tsx` cuatro KPI y tabla expandible con drawer de guías y curva; sin reemplazar la pantalla operativa |
| Administración → Cliente → Contrato | `ClientInstallationsModule.tsx` | `AcContractConfig.tsx`: control opcional, curva mensual fija/variable/remanente, Excel y plantillas, frecuencia y aviso |
| Campañas → detalle | `CampaignsModule.tsx` | `AcCampaignEconomics.tsx` dentro de detalles desplegables: base 100%, máximo teórico, carencia y compra requerida, cobertura por contrato |
| Guía de despacho | `dispatch-actions.ts` + `create_dispatch_v1` | No cambia la RPC de emisión: triggers económicos aditivos congelan precio/imputan, y el reporte usa solo estados de guía contabilizables |
| Finanzas / Control presupuestario | `MaterialBudgetModule.tsx` / `FinanceInvoicesModule.tsx` | `AcSupplierCredits.tsx` y API `/api/ac/credits` con fecha SII, condición, plazo, estado y pago acreditado |
| Datos económicos | Nuevos endpoints `/api/ac/overview`, `/api/ac/contracts`, `/api/ac/campaign`, `/api/ac/credits` | Validación de perfil y fallbacks aislados |

## Advertencias / aspectos todavía no cerrados
1. **No hay recordatorios automáticos enviados**: el widget calcula próximos ciclos cuando se consulta. Requiere servicio programado y política de avisos/autorización.
2. **Clonado de campaña con un clic** no integrado al circuito operativo: debe reutilizar `createRegionalCampaign`, respetar instalaciones ya ocupadas, y copiar configuración sin crear ciclos falsos.
3. **Precio de guía previo a la activación no se reescribe**. Para históricos, se necesita un procedimiento explícito de validación documental y backfill autorizado.
4. El costo máximo actual consulta `materials.current_net_price`, que puede ser editado manualmente. Antes de consolidar auditoría histórica, registrar explícitamente CPP real a partir de movimientos de stock valorizados.
5. No se presenta gasto de compra de materiales compartidos entre distintos contratos sin un criterio auditable de distribución de bodega; se marca “Sin valor”.
6. **No se modifica la recepción oficial SII** ni se consulta la plataforma SII; la fecha debe verificarse e ingresar manualmente. El plazo de 30 días y el de aceptación/reclamo de 8 días admiten supuestos legales y comerciales que deben validarse documentalmente.
7. Las pruebas PostgreSQL usan PGlite con *fixtures*, **no son prueba de migración en proyecto Supabase aislado** ni sustituyen E2E de usuario autenticado, RLS multirrol, visibilidad móvil o QA de Production.
8. La edición de curva por meses se realiza en dos pasos (upsert de meses, luego activación); se requiere RPC transaccional para evitar un registro parcial ante falla del segundo paso antes de adoptar como herramienta financiera oficial.
9. El prorrateo del trigger acontece cuando se crea la línea de guía y se muestra como gasto solo al salir de borrador. Los eventos y periodos configurados más tarde no reimputan líneas existentes automáticamente. Debe definirse un reconciliador idempotente de historiales.
10. El motor es optativo y requiere **aplicación de migración en Supabase test aislado**, verificación RLS/autenticación y pruebas de regresión antes de habilitar datos reales.

## Pruebas y despliegue
`npm run test:ac-engine` verifica curvas, redondeo, días corridos y ejecución SQL en PGlite (contratos independientes, devolución y crédito). El `prebuild` ejecuta la suite junto con circuitos previos; después debe compilar Next.js con TypeScript. El Preview no constituye aceptación del circuito real hasta pasar navegador autenticado.
