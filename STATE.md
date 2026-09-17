# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `integracion/limpieza-en-finanzas`
- **Último commit:** `HEAD` — merge de `fix/conexion-y-limpieza-modulos` sobre la base `cd194b59a654e08a689faac87fa24a151651f63d`; el SHA final se verifica en GitHub al cerrar este mismo commit.
- **Preview desplegado:** `https://alemsi-materiales-git-integracion-limpieza-en-finanzas-alemsi.vercel.app` — READY para el commit de integración.
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Integración controlada de `fix/conexion-y-limpieza-modulos` en la línea de Finanzas; se restaura `middleware.ts`, se elimina `proxy.ts`, se conecta `BackupModule`, se retiran módulos legacy sin referencias nuevas detectadas y se unifica la clave privada de Supabase en `SUPABASE_SERVICE_ROLE_KEY`.
- **Archivos tocados:** infraestructura de sesión/configuración, `src/components/OperationalApp.tsx`, conteo por token, documentación de auditoría, eliminación de archivos legacy y actualización de continuidad/decisiones.
- **Cómo se probó:** Vercel ejecutó `npm run build` sobre la rama de integración y quedó READY; Next.js 15.5.25 completó su validación de tipos. Se auditó estructuralmente navegación de roles/Respaldos y los circuitos definidos en este STATE contra el código fusionado.
- **Build y tsc:** Build ✅ / validación de tipos de Next ✅ / `npx tsc --noEmit` ⚠️ no ejecutado como comando separado porque los conectores disponibles no exponen una consola del checkout remoto.

## Siguiente paso
- Revisar manualmente el Preview de `integracion/limpieza-en-finanzas` y, solo si la revisión es conforme, fusionar hacia `feat/finanzas-ui-desde-estable`.

## Pendientes conocidos
- [ ] Fusionar `integracion/limpieza-en-finanzas` hacia `feat/finanzas-ui-desde-estable` tras revisión manual.
- [ ] Ejecutar `npx tsc --noEmit` de forma independiente en un checkout/CI con consola antes de promover la rama.
- [ ] Validar de extremo a extremo los 6 roles y sus pestañas para confirmar que ninguna ruta autorizada cae en pantalla genérica.
- [ ] Revalidar despacho completo, especialmente entrega parcial → pendiente → guía con cantidades realmente entregadas, firma/recepción y comportamiento móvil.
- [ ] Probar manualmente Respaldos con Admin Total y la clave real antes de cerrar esa etapa.
- [ ] Revisar `InventoryModule.tsx`, detectado como posible componente huérfano sin import real localizado en el árbol actual; no eliminar sin auditoría separada.

## Circuitos que deben seguir funcionando (probar tras cualquier cambio en estos módulos)
1. Campaña: crear campaña → seleccionar instalaciones → verificar que una instalación ya en campaña activa aparezca bloqueada → cerrar campaña
2. Levantamiento: abrir toma → registrar remanente → verificar que la carencia se calcule como máximo autorizado − remanente → que no permita pedir más que la carencia
3. Abastecimiento → OC: consolidar → derivar OC → verificar que el presupuesto excedido ALERTE pero NO bloquee
4. Recepción: recibir contra OC → verificar que la diferencia quede registrada → que genere entrada de inventario
5. Despacho: preparar → tránsito → completar entrega → entrega parcial genera pendiente → guía refleja lo realmente entregado
6. Respaldos: Admin Total → descargar ZIP con clave real
7. Roles: que cada uno de los 6 roles vea solo sus pestañas y ninguna caiga en pantalla genérica
