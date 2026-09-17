# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `integracion/limpieza-en-finanzas`
- **Último commit:** `HEAD` — `docs: documentar rol Operaciones en METODOLOGIA`.
- **Preview desplegado:** `https://alemsi-materiales-git-integracion-limpieza-en-finanzas-alemsi.vercel.app`
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Se documentó `Operaciones` como séptimo rol oficial en `docs/METODOLOGIA.md`, con Inicio, Campañas, Levantamientos, Abastecimiento, Órdenes de compra, Recepción, Inventario y Guías/despacho/entregas. No se modificó la lógica de permisos.
- **Archivos tocados:** `docs/METODOLOGIA.md`, `STATE.md`.
- **Cómo se probó:** Revisión documental contra `roleModules` y la decisión de cierre; la conexión física de la pestaña Inventario queda para la Tarea 4.
- **Build y tsc:** Build ✅ / `npx tsc --noEmit` ✅ de la validación previa; verificación final completa pendiente de Tarea 7.

## Siguiente paso
- Tarea 4: conectar `InventoryModule.tsx` como pestaña propia `Inventario` para Admin Total, Gerencia, Bodega y Operaciones, separada de Recepción.

## Pendientes conocidos
- [ ] Fusionar `integracion/limpieza-en-finanzas` hacia `feat/finanzas-ui-desde-estable` solo después de la revisión manual final; no fusionar automáticamente.
- [ ] Conectar `InventoryModule.tsx` como pestaña propia `Inventario` para Admin Total, Gerencia, Bodega y Operaciones.
- [ ] Validar de extremo a extremo los 7 roles y sus pestañas para confirmar que ninguna ruta autorizada cae en pantalla genérica.
- [ ] Revalidar despacho completo, especialmente entrega parcial → pendiente → guía con cantidades realmente entregadas, firma/recepción y comportamiento móvil.
- [ ] Probar manualmente Respaldos con Admin Total y la clave real antes de cerrar esa etapa.

## Circuitos que deben seguir funcionando (probar tras cualquier cambio en estos módulos)
1. Campaña: crear campaña → seleccionar instalaciones → verificar que una instalación ya en campaña activa aparezca bloqueada → cerrar campaña
2. Levantamiento: abrir toma → registrar remanente → verificar que la carencia se calcule como máximo autorizado − remanente → que no permita pedir más que la carencia
3. Abastecimiento → OC: consolidar → derivar OC → verificar que el presupuesto excedido ALERTE pero NO bloquee
4. Recepción: recibir contra OC → verificar que la diferencia quede registrada → que genere entrada de inventario
5. Despacho: preparar → tránsito → completar entrega → entrega parcial genera pendiente → guía refleja lo realmente entregado
6. Respaldos: Admin Total → descargar ZIP con clave real
7. Roles: que cada uno de los 7 roles oficiales vea solo sus pestañas y ninguna caiga en pantalla genérica
