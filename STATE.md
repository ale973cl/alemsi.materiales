# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `integracion/limpieza-en-finanzas`
- **Último commit:** `HEAD` — `fix: sincronizar package-lock.json con dependencias de pdf-lib`.
- **Preview desplegado:** `https://alemsi-materiales-git-integracion-limpieza-en-finanzas-alemsi.vercel.app`
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Se sincronizó `package-lock.json` con `package.json` mediante `npm install`, incorporando `pdf-lib@1.17.1` y sus dependencias `@pdf-lib/standard-fonts@1.0.0`, `@pdf-lib/upng@1.0.1` y `tslib@1.14.1`.
- **Archivos tocados:** `package-lock.json`, `STATE.md`.
- **Cómo se probó:** En runner limpio con Node 22 se ejecutó `npm install`, luego se eliminó `node_modules` y `npm ci --ignore-scripts --no-audit --no-fund` completó correctamente (`added 60 packages in 7s`).
- **Build y tsc:** Build ✅ (validación previa de integración) / `npx tsc --noEmit` ✅ (validación previa independiente); verificación final completa pendiente de Tarea 7.

## Siguiente paso
- Tarea 2: corregir en `METODOLOGIA.md` la regla de bloqueo de campañas para eliminar el concepto de ciclo, sin modificar código de validación.

## Pendientes conocidos
- [ ] Fusionar `integracion/limpieza-en-finanzas` hacia `feat/finanzas-ui-desde-estable` solo después de la revisión manual final; no fusionar automáticamente.
- [ ] Formalizar en documentación la regla real de bloqueo de campañas: cualquier campaña `Abierta` bloquea a la instalación, sin concepto de ciclo.
- [ ] Documentar `Operaciones` como séptimo rol oficial; actualmente no tiene usuarios asignados en Supabase.
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
