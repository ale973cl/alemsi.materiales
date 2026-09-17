# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `feat/finanzas-ui-desde-estable`
- **Último commit:** `f9eb38171684ab8b8f8892d49171cb7bd90708d3` — `docs: establecer continuidad y metodologia del proyecto` (HEAD verificado antes de crear este STATE)
- **Preview desplegado:** `https://alemsi-materiales-git-feat-finanzas-ui-desde-estable-alemsi.vercel.app` — READY para `f9eb38171684ab8b8f8892d49171cb7bd90708d3`
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Se estableció la estructura inicial de continuidad del proyecto; el último cambio funcional previo fue la vista de Inventario con stock, reservado, disponible, Kardex y ajuste trazable por conteo físico.
- **Archivos tocados:** `STATE.md`; último cambio funcional previo en `src/components/modules/InventoryModule.tsx`.
- **Cómo se probó:** GitHub y Vercel verificados; el Preview de la rama está READY para el HEAD previo `f9eb38171684ab8b8f8892d49171cb7bd90708d3`.
- **Build y tsc:** ❌ (Build de Vercel ✅; `npx tsc --noEmit` no fue verificado por separado en esta sesión)

## Siguiente paso
- Completar la documentación permanente del proyecto en `docs/METODOLOGIA.md` y `docs/DECISIONES.md`, sin programar funcionalidad nueva.

## Pendientes conocidos
- [ ] Validar de extremo a extremo los 6 roles y sus pestañas para confirmar que ninguna ruta autorizada cae en pantalla genérica.
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
