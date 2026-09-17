# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `integracion/limpieza-en-finanzas`
- **Último commit:** `HEAD` — `docs: registrar decisiones de cierre de integración`.
- **Preview desplegado:** `https://alemsi-materiales-git-integracion-limpieza-en-finanzas-alemsi.vercel.app`
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Se agregaron a `docs/DECISIONES.md` tres decisiones de cierre: bloqueo de campaña sin concepto de ciclo, `Operaciones` como séptimo rol oficial y conexión de `InventoryModule.tsx` como pestaña independiente `Inventario`.
- **Archivos tocados:** `docs/DECISIONES.md`, `STATE.md`.
- **Cómo se probó:** Revisión de consistencia contra `docs/METODOLOGIA.md` y `src/components/OperationalApp.tsx` actuales.
- **Build y tsc:** Verificación final real pendiente de Tarea 7.

## Siguiente paso
- Tarea 6: anotar el pendiente de guía excepcional sin investigarlo ni construirlo.

## Pendientes conocidos
- [ ] Fusionar `integracion/limpieza-en-finanzas` hacia `feat/finanzas-ui-desde-estable` solo después de la revisión manual final; no fusionar automáticamente.
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
7. Roles y navegación: los 7 roles ven solo sus pestañas; Inventario aparece para Admin Total, Gerencia, Bodega y Operaciones y no cae en pantalla genérica
