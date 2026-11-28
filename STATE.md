# STATE — ALEMSI Materiales

## Documento de arquitectura económica
- El alcance implementado, arquitectura, estructura SQL, UI y límites conocidos están documentados en `docs/AC_MOTOR_ECONOMICO_ARQUITECTURA.md`; habilitación segura pendiente de base test aislada.


## Panel económico por campaña (2026-11-27)
- En el detalle de Campañas: presupuesto base 100% según cobertura, máximo teórico, carencia y compra requerida.
- Todo cálculo distingue contrato por instalación, no mezcla campañas multicontrato. El stock común no se reparte sin trazabilidad.
- Si faltan precios, meses o activación, se presenta ausencia y no se impide la operación.



## Facturas de proveedores · crédito/vencimientos
- Módulo opcional de factura proveedor `/api/ac/credits`, condiciones de pago, fecha de recepción SII, días de crédito, días de mora y pagos acreditados.
- Disponible como sección de Finanzas y junto a Control presupuestario; Inicio indica cantidad por vencer y vencidas.
- El SII no se consulta automáticamente: la fecha debe ingresarse con evidencia; la recepción normal no se bloquea por ausencia de información de crédito.
- Pagos reales no son simulados: se registran manualmente con referencia y fecha, bajo permisos de Finanzas/Admin.



## Configuración económica por contrato
- La ficha de contrato existente expone un panel opcional para perfiles autorizados. Permite valores fijos, curva variable por Excel, remanente, plantillas reutilizables, frecuencia y anticipación.
- API de lectura y actualización requiere sesión y rol; solo habilita control después de guardar meses. Desactivación no destruye histórico ni bloquea los circuitos de compra y entregas.
- La aplicación conserva sus formularios y datos existentes. No se aplicaron migraciones al proyecto conectado.



## Motor económico opcional — implementación inicial (2026-11-27)
- Nueva migración `20261127220000_ac_motor_economico_opcional.sql`: presupuesto mensual, plantillas, período por campaña/contrato, congelamiento de precios de guía y desglose de devengo, retornos acreditados, crédito de facturas, pagos y vistas invocadoras con RLS.
- Capa optativa por contrato `control_economico_activo=false` por defecto; no modifica operaciones activas ni migra datos.
- Endpoint `/api/ac/overview` restringido a roles financieros, que devuelve desactivado si falta la migración y no inventa presupuestos; widget de 4 KPI con tabla y detalle de guías en Inicio.
- El control toma como consumo las guías y no duplica el gasto al recibir facturas.
- El CPP congelado usa el valor `materials.current_net_price` disponible al crear la línea; puede carecer de evidencia de costo si se cambió manualmente. La capa requiere validación documental antes de ser confiable.
- Alertas de ciclo calculadas en lectura (no notificaciones autónomas ni fecha real de entrega).
- No se ejecutó migración contra Supabase compartido. Falta pruebas PostgreSQL aisladas y QA de navegador autenticado.



## Control presupuestario de materiales — 2026-11-27
- Vista dedicada `?vista=presupuesto` en Abastecimiento, visible a Admin Total, Gerencia y Admin. Filtra cliente, contrato y mes de documento.
- Fuente de gasto: línea neta de recepción confirmada `receipts.inventory_posted=true`, relacionada con línea de OC → línea de suministro → consolidado con `contract_id`. Incluye solo registros con trazabilidad contractual completa.
- Compras sin asignación contractual se reportan separadamente como `sin atribución`, nunca se distribuyen proporcionalmente.
- `contracts.net_budget` sigue siendo presupuesto de materiales configurado, sin periodicidad especificada. No se comparan automáticamente gastos mensuales con presupuesto anual/contractual ni se calcula saldo ficticio.
- Si falla cualquier consulta o hay más de 1000 registros por tabla, bloquea importes parciales e informa error.
- Solo lectura; permisos RLS y validación de rol; sin mutaciones de Supabase ni Production. Falta QA autenticado del circuito y auditoría contra documentos reales.



## Maestro de materiales desde Bodega — 2026-11-27
- Bodega incorpora vista «Maestro de materiales» y botón visible desde Inventario para perfiles autorizados (Admin Total, Gerencia, Admin).
- Reutiliza MaterialsCatalogModule sin duplicación: productos, familia, unidad, presentación, proveedores, valores netos y CSV.
- Carga datos en `?vista=maestro` de forma independiente y conserva existencias, reservas, conteos y Kardex.
- La navegación está restringida por rol; las operaciones de escritura siguen sujetas a autorizaciones del servidor.
- No se modifican Production, Supabase ni reglas de stock; falta QA de navegador autenticado.



## Redacción profesional de despachos — 2026-11-26
- Eliminada la secuencia instructiva extensa del encabezado.
- Textos de etapas y ayudas más breves y operativos, sin renombrar estados internos ni modificar botones y sus eventos.
- Las validaciones funcionales y alertas de errores se preservan.
- Sin cambios de datos, Production ni Supabase.


## Simplificación móvil operativa — 2026-11-26
- Vista móvil independiente <=760 px: cuatro KPI, guías conformes e incidencias, presupuesto neto de materiales y accesos directos a nueve vistas.
- Análisis completo disponible mediante expandir; no se eliminan gráficos, desglose de entregas ni presupuesto detallado.
- Barra inferior fija con Inicio, Necesidades, Recepción y Entregas; el menú original conserva Planificación, Bodega y Administración.
- Se conservan los mismos módulos, permisos, estados, acciones, rutas y datos que en escritorio; CSS móvil en archivo independiente.
- QA de navegador autenticado en 320/360 px pendiente; build no prueba interacción real.


## Seguimiento de entregas y presupuesto neto de materiales — 2026-11-26
- La medición económica del producto es **solo presupuesto de materiales**: `contracts.net_budget`. No representa el monto mensual/anual del servicio ni se multiplica por períodos sin una periodicidad contractual registrada.
- Inicio incorpora guías agrupadas por cliente, campaña o mes del movimiento, desglosadas en entregas conformes, en proceso e incidencias. Si hay más de 1.000 movimientos, informa el límite de los más recientes.
- Se muestran presupuestos netos configurados por contrato y sumatoria sin IVA; NO se inventa presupuesto utilizado/saldo cuando no existe vinculación valorizada y auditada.
- Los cálculos son de lectura para el perfil autenticado, sin mutaciones de Supabase, reglas de negocio ni Production. Pendiente validación visual móvil y prueba autenticada en Preview.


## Panel Inicio — 2026-11-25
- Corrección de tipo estricto: resumen acepta `null` para diferenciar fallos de lectura de cero confirmado; detectado por el primer build de Preview.
- Nuevo cockpit operacional con 6 KPI de proceso, gráfico comparativo de barras, 6 accesos y 3 métricas de maestros activos. No se calculan ni inventan datos de demo: conteos Supabase reales de la sesión.
- Una consulta de conteo fallida retorna `null` y se visualiza «—» con aviso; cero solo cuando el servidor confirma cero.
- Guías en proceso cuentan cinco estados operativos, no solo «Pendiente». Los gráficos aclaran que las escalas son relativas y no porcentajes de conversión.
- Estilos independientes `operations-dashboard.css` responsive; sin cambios de Production ni escrituras en Supabase.
- Pendiente QA de navegador: 320/360/desktop, lectura por rol y accesos navegables. Build no prueba la base de datos real.


## Revisión CRO + Stitch — 2026-11-25
- Rama aislada: `fix/qa-cro-ui-stitch-20261125` desde Preview `21f0da2`. Production y Supabase sin cambios.
- Auditoría estática de contrato UX en `tests/qa-ux-contract.mjs`: selección y confirmación por tanda multicliente, metadatos de guías, formato de OC en móvil/impresión y objetivos táctiles. Integrada a `prebuild` como `test:ux`.
- `operational-compact.css`: tamaño táctil mínimo de 44 px en pestañas, acciones de preparación y selección para pantallas pequeñas y dispositivos táctiles, sin alterar la identidad corporativa.
- Pendiente de comprobar en Preview: flujos reales autenticados de tanda/guías, OCR/documento leído, 320/360 px, teclado/foco y Core Web Vitals; pasar el build no los acredita.

<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual — 2026-11-17

### Continuación de ejecución: recepción V2

- Base local de este incremento: `7ebcc26ebd285639e54474c8c7f10efb37dc9346`.
  Restauración: `backup/alemsi-continuacion-20261117`; árbol inicialmente limpio.
- Las tres acciones de recepción comparten validación de documentos y cantidades.
  Finanzas sin OC ahora comprueba proveedor/materiales activos y duplicados previos.
  Contra OC se conserva recepción parcial aunque su neto físico difiera de la factura.
- Migración `20261118011206_receipt_integrity_v2.sql`, generada con CLI local, implementa
  identidad por RUT emisor/tipo/folio, un documento por OC, un movimiento por línea,
  registro/cotejo transaccional, reintentos idénticos y bloqueo de ediciones confirmadas.
- Las acciones existentes invocan las RPC únicamente con `ALEMSI_RECEIPT_V2=1`.
  Por defecto se mantiene el circuito anterior. El piloto rechaza `VERCEL_ENV=production`.
  Un error de RPC nunca deriva al circuito antiguo. Migración sin aplicar remotamente.
- PostgreSQL en memoria (PGlite) ejecuta la migración con fixture mínimo de columnas/RLS
  inspeccionados. Pruebas de registro/cotejo, RUT equivalente, reintento, cambio de contenido,
  reversión por fallos de líneas/auditoría, stock prematuro, roles y recepción parcial.
  No sustituye réplica completa, Auth real, concurrencia multi-conexión ni prueba móvil/OCR.
- Validación final: 68 pruebas aprobadas (30 circuitos, 15 importación, 9 calendario,
  14 recepción incluyendo el contenedor SQL), TypeScript sin errores y compilación final
  de Next.js con código 0. Primer build restringido detenido por bloqueo del entorno;
  repetición con procesos habilitados completada. No hay script lint separado.
- Vercel: el último despliegue de esta rama es Preview; Production corresponde a `main`.
  Se comprobó que no existe variable `ALEMSI_RECEIPT_V2` global ni override observado;
  subir el código no activa el piloto ni aplica la migración.
- Usuario indicó que la base actual contiene datos ficticios. Se usó para SELECT de esquema
  y políticas. Al estar conectada también a Production, no se cambió su estructura ni datos.
- Próximo paso: aplicar el piloto en un destino que no cambie Production, revisar todas las
  políticas/triggers remotos y probar pantalla → servidor → RPC con sesiones reales.
  Pagos/rendiciones, cuentas por pagar, calendario conectado, flota ampliada y gastos siguen
  pendientes; este incremento no los declara implementados.

### Antecedentes del incremento anterior

- Repositorio solicitado: `ale973cl/alemsi.materiales`.
- Rama local: `feat/alemsi-motor-integral`; base `e51916f9658d71bbd3d0663871b83b5c62fcc201`.
- Respaldo Git local: `backup/alemsi-motor-integral-20261117` al SHA de partida.
- Auditoría dirigida y contrato modular: `docs/ESTRUCTURA_TECNICA_V2.md`.
- Implementado localmente: motor puro `central-calendar.ts`, adaptador `fleet-calendar.ts`,
  nueve pruebas de calendario y comando `test:calendar` incorporado a `prebuild`.
  No hay integración a pantalla/API/DB ni alertas persistidas.
- Verificado: 30 pruebas de circuitos y 15 de importación existentes; 9 nuevas de calendario;
  `npx tsc --noEmit` y `npm run build` terminaron con código 0. Build con avisos
  previos de CSS y detección de raíz superior por múltiples lockfiles, sin cambio de configuración.
- Supabase: solo lectura de esquema, columnas, índices, políticas, triggers y dos conteos
  agregados de duplicados (ambos cero); no se escribieron datos ni se aplicaron migraciones.
- Bloqueo conectado: Preview y Production comparten `vxqxbjkttymgvyskzheu` por la misma
  variable de URL. Sin override de rama observado. Pendiente decisión del usuario sobre
  base aislada; `ajwmnxqqgrwudhjzoxzz` no tiene tablas públicas y no se modificó.
- Pendientes: documento único transaccional, recepción atómica/idempotente, cuentas por
  pagar y abonos, acreditación de rendiciones, calendario conectado, flota/grúa/siniestros,
  gastos e informes integrados. Las tablas remotas de extensiones no están reproducidas
  por migraciones de este clon. Ver matriz y criterios de aceptación en el documento técnico.
- No se desplegó este incremento ni se modificó Production. No se certifican circuitos
  completos, concurrencia, rollback real, permisos conectados ni interfaz móvil.

## Estado histórico anterior (no representa esta rama)
- **Rama activa:** `fix/login-correo-o-perfil`
- **Último commit:** `HEAD` — `fix: unificar acceso dinámico por correo o perfil`.
- **Preview desplegado:** pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Se reemplazó el alias Gerencia dependiente de una variable de entorno por resolución dinámica de los 7 roles oficiales: Admin Total, Gerencia, Admin, Finanzas, Operaciones, Bodega y Supervisora. El servidor consulta `user_profiles` con la clave privada ya existente, considera solo usuarios activos y usa el correo real para autenticar con Supabase Auth. El alias funciona únicamente cuando hay exactamente un usuario activo en el rol; si hay más de uno, exige correo individual para preservar trazabilidad. El acceso directo por correo se mantiene sin cambios.
- **Archivos tocados:** `src/app/login/actions.ts`, `src/app/login/page.tsx`, `STATE.md`.
- **Cómo se probó:** revisión estructural: no hay correos hardcodeados ni variables por usuario; la clave privada permanece solo en servidor; el flujo final continúa usando `signInWithPassword` de Supabase Auth. Prueba funcional en Preview pendiente.
- **Build y tsc:** pendientes del deployment/CI de esta rama.

## Siguiente paso
- Desplegar Preview y probar: correo normal; alias de un rol con un único usuario activo; contraseña incorrecta; rol inexistente; y comportamiento de un rol con más de un usuario activo. Validar además la vista previa compartida como `ALEMSI Materiales`. Solo después promover los cambios validados a Production.

## Pendientes conocidos
- [ ] Validar LOGIN-01 dinámico en Preview antes de Production.
- [ ] Validar en WhatsApp que el enlace desplegado muestre `ALEMSI Materiales` y no `Demo editable`; WhatsApp puede conservar caché de enlaces anteriores.
- [ ] Corregir el generador de links de conteo para usar el dominio estable de Production y no el hostname temporal del deployment.
- [ ] Revisar `PDI Angol · Cuartel 2`: el token público abre correctamente pero no encuentra materiales autorizados; comprobar primero el perfil de materiales de la instalación.
- [ ] Revisar Finanzas por perfil: navegación compacta, resumen/prefiltros dinámicos, facturas/pagos y OC comprometidas sin inventar estados financieros inexistentes.
- [ ] Verificar si el sistema permite hoy crear una guía de despacho excepcional para una instalación que ya tiene campaña abierta, sin pasar por el flujo de campaña.
- [ ] Resolver/confirmar alcance operativo del rol `Operaciones`: navegación muestra Levantamientos y Abastecimiento/OC, pero `saveSurveyWithTrace` y `createPurchaseOrderFromConsolidated` no incluyen `Operaciones` entre los roles autorizados.
- [ ] Confirmar alerta explícita de los cuatro estados presupuestarios en Abastecimiento → OC; presupuesto alerta y nunca bloquea.
- [ ] Revalidar despacho completo manualmente, especialmente entrega parcial → pendiente → guía con cantidades realmente entregadas, firma/recepción y comportamiento móvil.

## Circuitos que deben seguir funcionando
1. **Campaña:** crear campaña → instalación en campaña `Abierta` queda bloqueada para otra → cierre libera instalación.
2. **Levantamiento:** `carencia = máximo autorizado − remanente`, limitada a cero; no permitir necesidad superior a carencia.
3. **Abastecimiento → OC:** cantidad no supera saldo pendiente; presupuesto excedido ALERTA pero NO bloquea.
4. **Recepción:** recibir contra OC → diferencias → cotejo financiero → movimientos positivos de inventario.
5. **Despacho:** preparar → tránsito → entrega → parcial genera saldo/complementaria → guía refleja entregado.
6. **Respaldos:** solo Admin Total; ZIP CSV/JSON mediante claves seguras de servidor.
7. **Roles y navegación:** 7 roles oficiales; cada uno ve solo sus módulos autorizados.
8. **Login:** correo funciona siempre; alias de rol se resuelve dinámicamente solo con exactamente un usuario activo y nunca sustituye Supabase Auth.
9. **Enlaces compartidos:** metadata público identifica el sistema como `ALEMSI Materiales`, ERP de gestión de materiales y abastecimiento; no debe presentarse como demo.
