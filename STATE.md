# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `recovery/estable-login-9c0a88a`
- **Último commit:** `HEAD` — `fix: permitir aproximación superior controlada en OC`.
- **Preview desplegado:** recuperación conectada; nuevo Preview pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-18

## Última tarea completada
- **Qué se hizo:** Se corrigió la incompatibilidad entre la aproximación de compra y la validación del servidor. La necesidad/carencia conserva su valor real decimal, pero la cantidad de OC para el saldo pendiente puede llegar como máximo a su entero superior (ceil). La interfaz propone ese entero al usar “Tomar todo pendiente”, restringe la cantidad a enteros y el servidor revalida el mismo máximo. No se modificó la fórmula de carencia ni el esquema de Supabase.
- **Archivos tocados:** `src/app/supply-actions.ts`, `src/components/modules/ConsolidatedSupplyModule.tsx`, `STATE.md`.
- **Cómo se probó:** se aisló en logs de Vercel el error real `La cantidad seleccionada supera el saldo pendiente (0.75)` (digest `3714015892`) en el Preview de recuperación. Validación funcional del nuevo commit pendiente de Preview.
- **Build y tsc:** pendientes del deployment/CI de esta rama.

## Siguiente paso
- Validar en Preview Login y generación de OC en PC/móvil: el loader debe aparecer inmediatamente, bloquear doble clic y finalizar con la respuesta real. Repetir además OC `0,75 → 1`. Si queda estable, extender el mismo componente a Guardar, Enviar, Confirmar, Cargar y Procesar sin modificar reglas de negocio.

## Pendientes conocidos
- [x] Validado que la rama de recuperación carga datos reales desde Supabase; el error observado provenía de la validación de cantidad OC.\n- [ ] Validar en Preview la aproximación OC `0,75 → 1` sin error de Server Components.
- [x] Reincorporado `Ingresando…` y loader corporativo en Login y OC; pendiente validación en Preview PC/móvil.
- [ ] Reincorporar después las mejoras responsive de Campañas, Clientes, detalle Cliente y Matriz Material × Instalación.
- [ ] Eliminar el texto explicativo inferior de la Matriz cuando se retome su mejora.
- [ ] Revalidar Supervisora únicamente sobre un Preview conectado y estable.
- [ ] Corregir el generador de links de conteo para usar el dominio estable de Production.
- [ ] Revisar `PDI Angol · Cuartel 2`: token público abre pero no encuentra materiales autorizados.
- [ ] Revisar Finanzas por perfil sin inventar estados financieros inexistentes.
- [ ] Resolver/confirmar alcance operativo del rol `Operaciones` en Levantamientos y Abastecimiento/OC.
- [ ] Confirmar los cuatro estados presupuestarios en Abastecimiento → OC; presupuesto alerta y nunca bloquea.
- [ ] Revalidar despacho completo manualmente, especialmente entrega parcial → pendiente → guía, firma/recepción y móvil.

## Circuitos que deben seguir funcionando
1. **Campaña:** crear campaña → instalación en campaña `Abierta` queda bloqueada para otra → cierre libera instalación.
2. **Levantamiento:** `carencia = máximo autorizado − remanente`, limitada a cero; no permitir necesidad superior a carencia.
3. **Abastecimiento → OC:** necesidad original se conserva; la cantidad OC puede aproximarse hacia arriba hasta `ceil(saldo pendiente)`; presupuesto excedido ALERTA pero NO bloquea.
4. **Recepción:** recibir contra OC → diferencias → cotejo financiero → movimientos positivos de inventario.
5. **Despacho:** preparar → tránsito → entrega → parcial genera saldo/complementaria → guía refleja entregado.
6. **Respaldos:** solo Admin Total; ZIP CSV/JSON mediante claves seguras de servidor.
7. **Roles y navegación:** 7 roles oficiales; cada uno ve solo sus módulos autorizados.
8. **Login:** correo funciona siempre; alias de rol se resuelve dinámicamente solo con exactamente un usuario activo y nunca sustituye Supabase Auth.
9. **Enlaces compartidos:** metadata público identifica el sistema como `ALEMSI Materiales`.
