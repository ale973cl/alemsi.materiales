# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `integracion/limpieza-en-finanzas`
- **Último commit:** `HEAD` — `feat: conectar InventoryModule como pestaña Inventario`.
- **Preview desplegado:** `https://alemsi-materiales-git-integracion-limpieza-en-finanzas-alemsi.vercel.app`
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Se conectó `InventoryModule.tsx` como pestaña independiente `Inventario`, separada de `Recepción`. Es visible para Admin Total, Gerencia, Bodega y Operaciones. La etiqueta combinada `Recepción e inventario` se separó en `Recepción` e `Inventario`; no se alteró el componente de Recepción ni la lógica interna de Inventario.
- **Archivos tocados:** `src/components/OperationalApp.tsx`, `STATE.md`.
- **Cómo se probó:** Auditoría de navegación: `InventoryModule` se importa y renderiza en `tab === "inventario"`; `roleModules` incluye `inventario` solo para Admin Total, Gerencia, Operaciones y Bodega; la pantalla genérica excluye el tab nuevo.
- **Build y tsc:** Verificación final real pendiente de Tarea 7.

## Siguiente paso
- Tarea 5: registrar en `docs/DECISIONES.md` las decisiones de campaña, rol Operaciones e Inventario.

## Pendientes conocidos
- [ ] Fusionar `integracion/limpieza-en-finanzas` hacia `feat/finanzas-ui-desde-estable` solo después de la revisión manual final; no fusionar automáticamente.
- [ ] Registrar las decisiones de cierre en `docs/DECISIONES.md`.
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
