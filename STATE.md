# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `integracion/limpieza-en-finanzas`
- **Último commit:** `ece56830fb95bb7aec21af9247b5c856de324811` — `ci: ejecutar typecheck real con entorno compatible` (HEAD verificado antes de este commit de actualización de STATE)
- **Preview desplegado:** `https://alemsi-materiales-git-integracion-limpieza-en-finanzas-alemsi.vercel.app` — READY para la integración validada.
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Investigación de rol `Operaciones`, alcance real del concepto de ciclo, estado de `InventoryModule.tsx` y ejecución independiente real de `npx tsc --noEmit`; no se modificó lógica de negocio.
- **Archivos tocados:** `STATE.md`; se creó temporalmente `.github/workflows/typecheck-integracion.yml` para ejecutar el typecheck real y se retira en este mismo cierre.
- **Cómo se probó:** historial Git y archivos reales de la rama; consulta SQL directa a Supabase para roles y esquema; GitHub Actions ejecutó `npx tsc --noEmit` sobre `integracion/limpieza-en-finanzas`; Preview de Vercel continúa READY.
- **Build y tsc:** `npm run build` ✅ (Vercel, Next.js 15.5.25) / `npx tsc --noEmit` ✅ (GitHub Actions, ejecución independiente real, exit 0)

## Siguiente paso
- Revisar manualmente los hallazgos pendientes y decidirlos antes de fusionar `integracion/limpieza-en-finanzas` hacia `feat/finanzas-ui-desde-estable`.

## Pendientes conocidos
- [ ] Fusionar `integracion/limpieza-en-finanzas` hacia `feat/finanzas-ui-desde-estable` solo tras revisión manual y resolución de los hallazgos abiertos.
- [ ] Definir el destino del rol `Operaciones`: el rol técnico fue introducido en `dd46e0f632443150434d7efbca2dfe6e779e0136`; hoy ve Inicio, Campañas, Levantamientos, Abastecimiento, OC, Recepción y Despacho; Supabase no tiene usuarios reales con ese rol.
- [ ] Definir el concepto de `ciclo` de campaña: no existe columna/tabla `cycle`/`ciclo` ni discriminador de ciclo en la lógica; el bloqueo actual impide que una instalación participe en cualquier otra campaña `Abierta`.
- [ ] Decidir la conexión de `InventoryModule.tsx`: fue creado en `e19b773d7a6e4443d1f223fbeb8c058c498d4fea`, contiene una vista funcional de stock/Kardex/conteo físico y no presenta TODO o funciones incompletas, pero actualmente no está importado/renderizado desde la navegación.
- [ ] Sincronizar `package-lock.json` con `package.json`: el primer intento de CI con `npm ci` detectó que faltan `pdf-lib@1.17.1`, `@pdf-lib/standard-fonts@1.0.0`, `@pdf-lib/upng@1.0.1` y `tslib@1.14.1` en el lockfile. No se corrigió en esta tarea.
- [ ] Validar de extremo a extremo los 6 roles oficiales y sus pestañas para confirmar que ninguna ruta autorizada cae en pantalla genérica.
- [ ] Revalidar despacho completo, especialmente entrega parcial → pendiente → guía con cantidades realmente entregadas, firma/recepción y comportamiento móvil.
- [ ] Probar manualmente Respaldos con Admin Total y la clave real antes de cerrar esa etapa.

## Circuitos que deben seguir funcionando (probar tras cualquier cambio en estos módulos)
1. Campaña: crear campaña → seleccionar instalaciones → verificar que una instalación ya en campaña activa aparezca bloqueada → cerrar campaña
2. Levantamiento: abrir toma → registrar remanente → verificar que la carencia se calcule como máximo autorizado − remanente → que no permita pedir más que la carencia
3. Abastecimiento → OC: consolidar → derivar OC → verificar que el presupuesto excedido ALERTE pero NO bloquee
4. Recepción: recibir contra OC → verificar que la diferencia quede registrada → que genere entrada de inventario
5. Despacho: preparar → tránsito → completar entrega → entrega parcial genera pendiente → guía refleja lo realmente entregado
6. Respaldos: Admin Total → descargar ZIP con clave real
7. Roles: que cada uno de los 6 roles vea solo sus pestañas y ninguna caiga en pantalla genérica
