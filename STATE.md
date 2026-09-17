# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `feat/finanzas-ui-desde-estable`
- **Último commit:** `HEAD` de esta rama. Base funcional verificada antes de crear esta estructura: `e19b773d7a6e4443d1f223fbeb8c058c498d4fea` — `Inventario: vista stock, reservado, disponible y Kardex`.
- **Preview desplegado:** `https://alemsi-materiales-git-feat-finanzas-ui-desde-estable-alemsi.vercel.app` (último deployment funcional verificado antes de este commit: READY para `e19b773d7a6e4443d1f223fbeb8c058c498d4fea`).
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Inventario operativo con vista de stock, reservado, disponible, Kardex y ajuste trazable por conteo físico.
- **Archivos tocados:** `src/components/modules/InventoryModule.tsx` y dependencias de inventario de los commits inmediatamente anteriores.
- **Cómo se probó:** el último commit funcional fue desplegado por Vercel y quedó en estado READY en el Preview de la rama.
- **Build y tsc:** Build ✅ (Vercel READY) / tsc ⚠️ no verificado por separado en esta sesión.

## Siguiente paso
- Leer este archivo antes de cualquier cambio y confirmar que GitHub/Vercel siguen apuntando a esta rama. No iniciar funcionalidad nueva sin definir primero la tarea concreta.

## Pendientes conocidos
- [ ] Validar de extremo a extremo los 6 roles y sus pestañas después de los cambios recientes, evitando rutas que caigan en pantalla genérica.
- [ ] Revalidar el circuito de despacho completo, especialmente entrega parcial → pendiente → guía con cantidades realmente entregadas, y revisar su comportamiento móvil.

## Circuitos que deben seguir funcionando (probar tras cualquier cambio en estos módulos)
1. **Campaña:** crear campaña → seleccionar instalaciones → verificar que una instalación ya en campaña activa aparezca bloqueada → cerrar campaña
2. **Levantamiento:** abrir toma → registrar remanente → verificar que la carencia se calcule como máximo autorizado − remanente → que no permita pedir más que la carencia
3. **Abastecimiento → OC:** consolidar → derivar OC → verificar que el presupuesto excedido ALERTE pero NO bloquee
4. **Recepción:** recibir contra OC → verificar que la diferencia quede registrada → que genere entrada de inventario
5. **Despacho:** preparar → tránsito → completar entrega → entrega parcial genera pendiente → guía refleja lo realmente entregado
6. **Respaldos:** Admin Total → descargar ZIP con clave real
7. **Roles:** que cada uno de los 6 roles vea solo sus pestañas y ninguna caiga en pantalla genérica

## Regla permanente de continuidad
Antes de cualquier tarea se lee `STATE.md`. Toda tarea que cambie código actualiza `STATE.md` en el MISMO commit. Si el código avanza y este archivo no, el trabajo está incompleto.
