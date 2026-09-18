# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `recovery/estable-login-9c0a88a`
- **Último commit:** `HEAD` — `chore: fijar punto estable de recuperación`.
- **Preview desplegado:** pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-18

## Última tarea completada
- **Qué se hizo:** Se creó una rama limpia de recuperación exactamente desde el commit estable `9c0a88a45f645890a38c10b3cf33a804c55fedee` (`fix: unificar acceso dinámico por correo o perfil`). No se incorporaron los cambios posteriores de spinner ni responsive, porque los últimos Preview presentaron pérdida de carga de Campañas, OC y otros datos. Las ramas posteriores se conservan solo como referencia.
- **Archivos tocados:** `STATE.md`.
- **Cómo se probó:** se verificó en GitHub que el commit base existe y corresponde al login dinámico acordado como último punto conocido estable. La prueba funcional de conexión y carga de datos debe realizarse en el Preview de esta rama.
- **Build y tsc:** pendientes del deployment/CI de esta rama.

## Siguiente paso
- Desplegar esta rama en Preview y validar primero la conexión funcional: iniciar sesión y comprobar que carguen Campañas, Levantamientos, OC, Recepción y Despacho. No reincorporar ninguna mejora posterior hasta que esta base quede validada.

## Pendientes conocidos
- [ ] Validar en Preview que la base `9c0a88a` vuelva a cargar datos reales desde Supabase.
- [ ] Reincorporar después, de forma aislada y validada, el spinner `Ingresando…` en escritorio y móvil.
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
3. **Abastecimiento → OC:** cantidad no supera saldo pendiente; presupuesto excedido ALERTA pero NO bloquea.
4. **Recepción:** recibir contra OC → diferencias → cotejo financiero → movimientos positivos de inventario.
5. **Despacho:** preparar → tránsito → entrega → parcial genera saldo/complementaria → guía refleja entregado.
6. **Respaldos:** solo Admin Total; ZIP CSV/JSON mediante claves seguras de servidor.
7. **Roles y navegación:** 7 roles oficiales; cada uno ve solo sus módulos autorizados.
8. **Login:** correo funciona siempre; alias de rol se resuelve dinámicamente solo con exactamente un usuario activo y nunca sustituye Supabase Auth.
9. **Enlaces compartidos:** metadata público identifica el sistema como `ALEMSI Materiales`.
