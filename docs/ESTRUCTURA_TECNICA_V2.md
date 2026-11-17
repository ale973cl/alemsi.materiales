# ALEMSI Materiales V2 — estructura técnica y brechas verificadas

Fecha: 2026-11-17. Alcance solicitado: `ale973cl/alemsi.materiales`, rama
`feat/alemsi-motor-integral`. Base inspeccionada: `e51916f9658d71bbd3d0663871b83b5c62fcc201`.
La instrucción actual del usuario determina este repositorio; no se cambió al repositorio
`.v2` mencionado en instrucciones históricas de los complementos.

Este documento distingue implementación de contrato pendiente. No certifica el sistema
completo, pruebas conectadas ni aislamiento de Preview.

## Evidencia y protección de Production

- Clon de la rama con árbol inicialmente limpio; referencia local de restauración:
  `backup/alemsi-motor-integral-20261117` al SHA de partida. No hubo cambios locales ajenos.
- `STATE.md` anterior describía otra rama, de septiembre; se conserva abajo como historia.
- Lectura de esquema público, columnas seleccionadas, índices, políticas y triggers en
  Supabase `vxqxbjkttymgvyskzheu`. Solo SELECT y herramientas de inventario de esquema.
- La variable de Vercel `NEXT_PUBLIC_SUPABASE_URL` tiene el mismo valor
  `https://vxqxbjkttymgvyskzheu.supabase.co` para development, preview y production.
  La consulta de variables específicas para esta rama devolvió una lista vacía.
  Por ello el Preview actual no constituye una base de pruebas aislada.
- Proyecto Vercel encontrado: `alemsi-materiales`, ID `prj_5Vuk6IGe5nRNB5Vn2I0waLcxN3De`.
  No se modificaron variables, despliegues, dominios ni permisos.
- El otro proyecto Supabase de esta cuenta, `ajwmnxqqgrwudhjzoxzz`, no tiene tablas
  públicas. No se presupone que esté disponible o autorizado para V2.
- No se aplicaron migraciones, escrituras de negocio, pagos, correos ni cambios en Production.

## Matriz de módulos

| Circuito | Fuente actual comprobada | Brecha / implementación pendiente |
| --- | --- | --- |
| Compras | `supply-actions.ts`, `purchase-order-actions.ts`, `purchase-order-balance.ts`, tablas OC y líneas | Conservar saldo comprometido, recepción parcial y presupuesto no bloqueante; validar concurrencia con DB aislada. |
| Documento único | Tres registros: `receipt-actions.ts`, `receipt-no-oc-actions.ts`, `finance-purchase-actions.ts` | Comprobación previa por proveedor/tipo/folio en algunos caminos; no hay restricción única equivalente en DB. Identidad por RUT emisor/tipo/folio aún no implementada. |
| Recepción/inventario | `reconcilePurchaseDocument`, `receipts`, `receipt_lines`, `inventory_movements` | Cotejo usa múltiples escrituras sin transacción. Índice por línea no único para entradas. Falta operación atómica, idempotencia y pruebas de rollback/concurrencia. |
| Cuentas por pagar | `FinancePurchaseRegister`, APIs `/api/finance/*`, `finance_movements` | `receipts` carece de vencimiento y condición estructurada; no hay relación de abonos con factura en `finance_movements`. No confundir estado de inventario con saldo financiero. |
| Rendiciones | Tablas `renditions`, `rendition_expenses`, saldos y tokens; acceso adicional por servicio | Hay esquema remoto, pero no módulos/rutas de rendición en este clon. Enlace `document_id` apunta a documentos; no prueba identidad única ni pago de factura. |
| Calendario | Nuevo `central-calendar.ts` y adaptador `fleet-calendar.ts` | Motor y pruebas locales implementados. Sin pantalla, API, persistencia de parámetros, responsable/resolución ni suscripción automática de fuentes. |
| Flota | Nueve tablas `fleet_*`, incluyendo documentos, mantenciones, fotos, daños, ubicaciones y settings | Esquema remoto más amplio que el clon: no se hallaron migraciones `fleet_*` ni módulo UI aquí. Seguros ya tienen contactos e instrucciones; faltan circuito de grúa/siniestros y confirmación por campo. |
| Gastos operacionales | Rutas y vínculos a despachos disponibles; gastos en rendiciones y combustible/mantención de flota | Falta contrato persistido de imputación única por ruta/entrega/campaña e informes sin doble contabilización. |
| Reportes | `FinanceDashboard`, reporte ZIP de entregas, registros actuales | No hay evidencia de reporte integral de saldo por factura ni costos distribuidos por ruta; definir fuentes y evitar sumar originales más imputaciones. |

RLS está habilitado en las tablas listadas, pero eso no demuestra autorización correcta.
En particular: `reconcilePurchaseDocument` admite Admin Total/Gerencia/Finanzas, mientras
la política INSERT de inventario admite Admin Total/Admin/Bodega. Gerencia tampoco aparece
en la política ALL de recepción. No se amplió RLS para ocultar esta incompatibilidad.

Las dos consultas agregadas de duplicados devolvieron cero grupos tanto para
proveedor/tipo/folio como para entradas por línea de recepción. Esto describe los datos
consultados, no garantiza inmunidad ante solicitudes concurrentes ni equivalencia entre
dos proveedores con el mismo RUT.

## Contratos de integración a implementar en el entorno aislado

### Compras, documento y recepción

Mantener las OC y las líneas existentes como origen. Separar documento comercial y
recepción física: una factura no es automáticamente una entrada de inventario y una
recepción parcial no debe duplicar la factura. Clave documental: ámbito de empresa real,
RUT emisor normalizado y validado, tipo canónico y folio normalizado. Conservar campos
originales e instantáneas. Antes de crear el índice único, auditar equivalencias y conflictos;
no eliminar ni combinar históricos automáticamente. Las guías y otros documentos deben
tener tipo explícito; no se transforman en factura por defecto.

Una operación DB debe validar sesión, rol, alcance y relaciones, bloquear la recepción y
líneas de OC involucradas, revalidar cantidades pendientes, crear movimientos y completar
estado/auditoría en la misma transacción. Restricción única para entrada por línea como
segunda defensa. Reintento idéntico devuelve el resultado previo; contenido distinto con
la misma clave falla. Un error revierte todo. No introducir una segunda ruta de escritura
en paralelo a las tres actuales: migrar sus consumidores hacia un único servicio.

El código actual recalcula promedio ponderado de precio dentro del cotejo. Se dejó intacto:
no es una nueva decisión aprobada de valorización. Revisar expresamente su contrato antes
de trasladarlo a la transacción; no introducir FIFO/LIFO/FEFO/COGS/EOQ.

### Facturas, abonos y rendiciones

Cuenta por pagar vinculada al documento canónico; total, moneda, condición y vencimiento
estructurados. `saldo = total − suma(abonos acreditados no revertidos)`, con precisión
decimal y reglas explícitas de redondeo. Reservar estados financieros independientes de
recepción: pendiente, parcial, pagada; distinguir anulación/reversión según contrato.

Cada abono tiene identificador externo/idempotente, origen y evidencia. La acreditación
de una rendición enlaza ese mismo abono; no crea otro ingreso físico ni cancela por mera
coincidencia de monto. Verificar identidad, estado de aprobación, titular, factura y saldo
en la misma transacción; rechazar sobrepago y referencia repetida con contenido distinto.
Los anticipos y comprobantes originales se conservan; correcciones por reversión trazable.

### Calendario central

Cada módulo conserva su fuente y suministra eventos normalizados. Identidad del evento:
`module/sourceId/kind`; no duplicar tablas de facturas o documentos para calendarizar.
`central-calendar.ts` calcula días civiles en Chile y kilómetros por separado, elige la
alerta por el límite que vence primero y omite resueltos. Rechaza fechas imposibles,
umbrales y kilometrajes inválidos. Distingue ausencia de datos de cero.

Los umbrales son entradas obligatorias del motor; no se inventó una configuración de
negocio. Persistirlos por ámbito/módulo con responsable, permisos y auditoría en el futuro
servicio de configuración. El adaptador de flota toma documentos `is_current` y solo planes
actuales ya seleccionados por el consumidor. No deduce que todos los registros históricos
de mantenimiento sean obligaciones vigentes. No estima fecha de aceite desde km sin una
serie de uso suficiente. La autorización corresponde al servidor y RLS antes de invocar
el motor. Motor puro no significa control de acceso implementado.

### Flota y pólizas

Seis secciones: vehículos; documentación y seguros; asignaciones; combustible;
mantenciones; informes. Fotos, ubicaciones y deterioros pertenecen al evento/asignación
original. Preservar versión, `is_current`, archivo y datos confirmados de `fleet_documents`.
Los campos de contacto/cobertura/instrucciones ya existen; no duplicarlos en un maestro nuevo.

Separar asistencia/grúa de siniestro con identificador de caso, vehículo, póliza y versión,
ubicación, responsable, fechas, evidencias, número de aseguradora, estado e historial.
Plazos e instrucciones provienen de la póliza confirmada; no fijar condiciones universales.
Extracción automática queda pendiente de confirmación manual y conserva el texto original.
Documentos privados mediante Storage con políticas y descarga autorizada.

### Gastos, reportes y extensiones

Gasto único y origen trazable: combustible, peaje, colación, viático u otro aprobado.
Imputaciones separadas hacia ruta/entregas seleccionadas, que suman exactamente el monto
imputable y no duplican gasto al consolidar por instalación, contrato o campaña.
No inferir pago desde comprobante ni consumo de materiales desde gasto rendido.

Rendiciones, flota y gastos operacionales son extensiones desactivadas por defecto.
Reutilizar `additional_services`, accesos por usuario y predicados existentes tras auditar
su esquema completo. Habilitación de servicio y permiso por operación se verifican en
servidor/RLS. No sustituirlos por un botón o flag enviado por navegador.

Reportes paginados con filtros por alcance autorizado, fuentes explícitas y corte temporal;
no sumar dos veces abonos enlazados ni gastos distribuidos. Mostrar faltantes de datos
como tales, no como cero confirmado. Documentos emitidos conservan instantáneas.

## Orden y aceptación de implementación conectada

1. Acordar base aislada y configurar Preview exclusivo de esta rama; verificar URL, Auth,
   Storage, correo y efectos externos. Preparar esquema desde fuente real y migraciones
   versionadas: el repositorio actual no reproduce todo el esquema remoto.
2. Documento canónico y recepción atómica: preservar OC y consumidores; pruebas simultáneas,
   doble envío, fallo intermedio/rollback, recepción parcial y reintento.
3. Cuenta por pagar y acreditación de rendiciones: pago parcial/total, duplicado,
   referencia conflictiva, reversión, sobrepago e independencia del inventario.
4. Calendario conectado a fuentes: permisos permitidos/denegados, facturas pagadas excluidas,
   planes vigentes, documentos sustituidos, fechas Chile, parámetros y resolución persistidos.
5. Flota y gastos: versiones de póliza, asistencia/siniestro, archivos privados,
   acceso sin servicio, asignación/devolución y distribución exacta de costos.
6. Reportes y recorrido de extremo a extremo, incluyendo móvil y acceso directo no autorizado.
   Build, TypeScript y verificaciones disponibles; Preview con rama/SHA y URL comprobados.

No se autoriza Production ni se afirma completada ninguna de estas etapas conectadas.

## Verificación ejecutada en este incremento

| Control | Resultado observado |
| --- | --- |
| `npm ci --ignore-scripts` | Código 0, 54 paquetes instalados; sin alterar lockfile. La salida reportó 4 vulnerabilidades (3 high, 1 critical); no se investigaron ni corrigieron en este incremento. |
| `npm run test:circuits` | 30 aprobadas, 0 fallidas; reglas aisladas, no circuito conectado. |
| `npm run test:import` | 15 aprobadas, 0 fallidas; incluye fallos/reversión con ejecutor de prueba, no rollback real Supabase. |
| `npm run test:calendar` | 9 aprobadas, 0 fallidas; motor puro y adaptador. |
| `npx tsc --noEmit` | Código 0. |
| `npm run build` | Código 0; tipos, generación de 25 páginas y trazas completadas. Su prebuild ejecutó las dos suites originales; calendario se ejecutó además por separado. |
| `git diff --check` | Sin errores. |
| Lint independiente | No hay script de lint en `package.json`; no se presenta como control separado aprobado. |
| Pruebas conectadas/UI/Preview | No ejecutadas: falta base aislada autorizada y configurada. |

El build mostró avisos de CSS sobre `end` y detectó una raíz superior por múltiples
lockfiles. Terminó correctamente sin modificar configuración ni archivos ajenos al repositorio.
La restricción de raíz se consultó en la [documentación oficial de Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats),
pero no fue necesario implementar ese cambio para terminar esta verificación.

La prueba de compilación y las suites aisladas no demuestran persistencia, permisos por
recurso, seguridad SaaS, circuito financiero ni comportamiento en Android real.
