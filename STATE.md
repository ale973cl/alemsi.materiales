# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `integracion/limpieza-en-finanzas`
- **Último commit:** `HEAD` — `chore: cerrar verificación final de integración`.
- **Preview desplegado:** `https://alemsi-materiales-git-integracion-limpieza-en-finanzas-alemsi.vercel.app`
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Cierre técnico de la integración: `package-lock.json` sincronizado, regla de campañas corregida en metodología, `Operaciones` documentado como séptimo rol oficial, `InventoryModule.tsx` conectado como pestaña independiente, decisiones registradas y pendiente de guía excepcional anotado. Se ejecutó verificación real de instalación limpia, build y TypeScript y se revisaron estructuralmente los 7 circuitos definidos en este STATE.
- **Archivos tocados:** en el cierre final solo `STATE.md`; las tareas previas quedaron en commits separados.
- **Cómo se probó:** GitHub Actions sobre checkout derivado del HEAD de integración: `npm ci --ignore-scripts --no-audit --no-fund` ✅ (`added 60 packages in 7s`), `npm run build` ✅ (Next.js 15.5.25, compilación y generación de 21 páginas completadas), `npx tsc --noEmit` ✅. Revisión estructural de campañas, levantamiento/carencia, abastecimiento/OC, recepción→inventario, despacho/entrega parcial, Respaldos y navegación de roles/Inventario.
- **Build y tsc:** `npm run build` ✅ / `npx tsc --noEmit` ✅ (ejecución real independiente). El build conserva dos advertencias preexistentes de Autoprefixer en `globals.css` por `end` → recomienda `flex-end`; no detienen compilación ni typecheck.

## Siguiente paso
- Prueba manual del Preview por el dueño: (1) Respaldos con Admin Total y la clave real; (2) pestaña Inventario con Admin Total/Gerencia/Bodega y, cuando exista usuario asignado, Operaciones. No fusionar hasta revisar los pendientes detectados en la auditoría de circuitos.

## Pendientes conocidos
- [ ] Fusionar `integracion/limpieza-en-finanzas` hacia `feat/finanzas-ui-desde-estable` solo después de la revisión manual final; no fusionar automáticamente.
- [ ] Verificar si el sistema permite hoy crear una guía de despacho excepcional para una instalación que ya tiene campaña abierta, sin pasar por el flujo de campaña. Si no existe esa vía, es una funcionalidad nueva a diseñar, no un bug.
- [ ] Resolver/confirmar alcance operativo del rol `Operaciones`: la navegación oficial le muestra Levantamientos y Abastecimiento/OC, pero las acciones servidor `saveSurveyWithTrace` y `createPurchaseOrderFromConsolidated` actualmente no incluyen `Operaciones` entre los roles autorizados. No se cambió esta lógica porque la tarea de documentación pidió expresamente no modificar permisos.
- [ ] Verificar el indicador presupuestario del circuito Abastecimiento → OC en prueba funcional: el flujo de OC conserva el límite de cantidades por carencia y no encontré bloqueo presupuestario en la acción de creación; Finanzas sí muestra presupuesto/flujo/consumo. En esta revisión estructural no quedó confirmada una alerta explícita con los cuatro estados de presupuesto definidos por negocio.
- [ ] Revalidar despacho completo manualmente, especialmente entrega parcial → pendiente → guía con cantidades realmente entregadas, firma/recepción y comportamiento móvil.
- [ ] Probar manualmente Respaldos con Admin Total y la clave real antes de cerrar esa etapa.

## Circuitos que deben seguir funcionando (probar tras cualquier cambio en estos módulos)
1. **Campaña:** crear campaña → seleccionar instalaciones → una instalación en cualquier campaña `Abierta` queda bloqueada para otra campaña → cierre libera la instalación. **Revisión estructural: ✅** bloqueo UI/servidor consistente con la regla sin concepto de ciclo.
2. **Levantamiento:** abrir toma → registrar remanente → `carencia = máximo autorizado − remanente`, limitada a cero → no generar necesidad superior a la carencia. **Revisión estructural: ✅** cálculo y persistencia confirmados en `survey-actions.ts`.
3. **Abastecimiento → OC:** consolidar → derivar OC → cantidad no supera saldo pendiente → presupuesto excedido debe ALERTAR pero NO bloquear. **Revisión estructural: ⚠️ parcial** límite por carencia confirmado y no hay bloqueo por presupuesto en creación de OC; alerta explícita de los cuatro estados queda pendiente de prueba/confirmación.
4. **Recepción:** recibir contra OC → registrar diferencias → cotejo financiero → generar movimientos positivos de inventario y marcar `inventory_posted`. **Revisión estructural: ✅**.
5. **Despacho:** preparar → tránsito → completar entrega → entrega parcial genera saldo/entrega complementaria → guía refleja lo entregado. **Revisión estructural: ✅**; prueba manual de firma/correo/móvil sigue pendiente.
6. **Respaldos:** solo Admin Total ve el módulo; endpoint exige `SUPABASE_SERVICE_ROLE_KEY` + `BACKUP_ADMIN_TOKEN` y genera ZIP CSV/JSON. **Revisión estructural: ✅**; descarga con clave real queda para prueba manual.
7. **Roles y navegación:** existen 7 roles oficiales; `Inventario` aparece como tab propio para Admin Total, Gerencia, Bodega y Operaciones y queda separado de `Recepción`. **Navegación: ✅**. **Acciones de Operaciones: ⚠️** revisar autorización servidor indicada en Pendientes conocidos.
