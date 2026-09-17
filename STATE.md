# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `fix/login-correo-o-perfil`
- **Último commit:** `HEAD` — `fix: unificar acceso dinámico por correo o perfil`.
- **Preview desplegado:** pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-17

## Última tarea completada
- **Qué se hizo:** Se reemplazó el alias Gerencia dependiente de una variable de entorno por resolución dinámica de los 7 roles oficiales: Admin Total, Gerencia, Admin, Finanzas, Operaciones, Bodega y Supervisora. El servidor consulta `user_profiles` con la clave privada ya existente, considera solo usuarios activos y usa el correo real para autenticar con Supabase Auth. El alias funciona únicamente cuando hay exactamente un usuario activo en el rol; si hay más de uno, exige correo individual para preservar trazabilidad. El acceso directo por correo se mantiene sin cambios.
- **Archivos tocados:** `src/app/login/actions.ts`, `src/app/login/page.tsx`, `STATE.md`.
- **Cómo se probó:** revisión estructural: no hay correos hardcodeados ni variables por usuario; la clave privada permanece solo en servidor; el flujo final continúa usando `signInWithPassword` de Supabase Auth. Prueba funcional en Preview pendiente.
- **Build y tsc:** pendientes del deployment/CI de esta rama.

## Siguiente paso
- Desplegar Preview y probar: correo normal; alias de un rol con un único usuario activo; contraseña incorrecta; rol inexistente; y comportamiento de un rol con más de un usuario activo. Validar además la vista previa compartida como `ALEMSI Materiales`. Solo después promover los cambios validados a Production.

## Pendientes conocidos
- [ ] Validar LOGIN-01 dinámico en Preview antes de Production.
- [ ] Validar en WhatsApp que el enlace desplegado muestre `ALEMSI Materiales` y no `Demo editable`; WhatsApp puede conservar caché de enlaces anteriores.
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
8. **Login:** correo funciona siempre; alias de rol se resuelve dinámicamente solo con exactamente un usuario activo y nunca sustituye Supabase Auth.
9. **Enlaces compartidos:** metadata público identifica el sistema como `ALEMSI Materiales`, ERP de gestión de materiales y abastecimiento; no debe presentarse como demo.
