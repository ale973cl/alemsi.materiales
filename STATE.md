# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `fix/login-correo-o-perfil`
- **Último commit:** `HEAD` — `fix: presentar ALEMSI Materiales como ERP en enlaces compartidos`.
- **Preview desplegado:** pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Se eliminó la descripción pública `Demo editable de control de materiales` de los metadatos raíz. El sitio se identifica ahora como `ALEMSI Materiales`, con descripción institucional de ERP de gestión de materiales y abastecimiento. Se agregaron metadatos Open Graph y Twitter para mejorar la vista previa al compartir enlaces por WhatsApp y otras aplicaciones. No se modificó autenticación, Supabase, roles ni lógica operacional.
- **Archivos tocados:** `src/app/layout.tsx`, `STATE.md`.
- **Cómo se probó:** revisión estructural del metadata de Next.js; la vista previa real de WhatsApp debe validarse una vez desplegada la rama porque WhatsApp puede conservar caché de enlaces anteriores.
- **Build y tsc:** pendientes del deployment/CI de esta rama.

## Siguiente paso
- Configurar en Vercel `LOGIN_GERENCIA_EMAIL` con el correo real de la única cuenta que representará el acceso simplificado Gerencia para Preview y Production. Desplegar esta rama y probar: `gerencia` + contraseña, correo + contraseña, contraseña incorrecta, Admin Total y vista previa del enlace compartido. Solo después promover los commits validados a Production.

## Pendientes conocidos
- [ ] Validar LOGIN-01 en Preview y promover únicamente después de las cuatro pruebas de autenticación.
- [ ] Validar en WhatsApp que el enlace desplegado muestre `ALEMSI Materiales` y no `Demo editable`; si WhatsApp conserva la vista anterior, probar con URL nueva o esperar actualización de caché.
- [ ] Corregir el generador de links de conteo para usar el dominio estable de Production y no el hostname temporal del deployment.
- [ ] Revisar `PDI Angol · Cuartel 2`: el token público abre correctamente pero no encuentra materiales autorizados; comprobar primero el perfil de materiales de la instalación.
- [ ] Revisar Finanzas por perfil: navegación compacta, resumen/prefiltros dinámicos, facturas/pagos y OC comprometidas sin inventar estados financieros inexistentes.
- [ ] Verificar si el sistema permite hoy crear una guía de despacho excepcional para una instalación que ya tiene campaña abierta, sin pasar por el flujo de campaña.
- [ ] Resolver/confirmar alcance operativo del rol `Operaciones`: navegación muestra Levantamientos y Abastecimiento/OC, pero `saveSurveyWithTrace` y `createPurchaseOrderFromConsolidated` no incluyen `Operaciones` entre los roles autorizados.
- [ ] Confirmar alerta explícita de los cuatro estados presupuestarios en Abastecimiento → OC; presupuesto alerta y nunca bloquea.
- [ ] Revalidar despacho completo manualmente, especialmente entrega parcial → pendiente → guía con cantidades realmente entregadas, firma/recepción y comportamiento móvil.

## Circuitos que deben seguir funcionando
1. **Campaña:** crear campaña → instalación en campaña `Abierta` queda bloqueada para otra → cierre libera instalación.
2. **Levantamiento:** `carencia = máximo autorizado − remanente`, limitada a cero; no permitir necesidad superior a carencia.
3. **Abastecimiento → OC:** cantidad no supera saldo pendiente; presupuesto excedido ALERTA pero NO bloquea.
4. **Recepción:** recibir contra OC → diferencias → cotejo financiero → movimientos positivos de inventario.
5. **Despacho:** preparar → tránsito → entrega → parcial genera saldo/complementaria → guía refleja entregado.
6. **Respaldos:** solo Admin Total; ZIP CSV/JSON mediante claves seguras de servidor.
7. **Roles y navegación:** 7 roles oficiales; cada uno ve solo sus módulos autorizados.
8. **Login:** correo sigue funcionando; alias `gerencia` solo resuelve la cuenta configurada y nunca sustituye Supabase Auth.
9. **Enlaces compartidos:** metadata público identifica el sistema como `ALEMSI Materiales`, ERP de gestión de materiales y abastecimiento; no debe presentarse como demo.
