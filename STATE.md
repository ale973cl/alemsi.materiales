# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `recovery/estable-login-9c0a88a`
- **Último commit:** este commit — `docs: inventariar funciones y riesgos estructurales`.
- **Preview desplegado:** el Preview anterior del commit `a449e6c` está READY; el Preview de este commit queda pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-19

## Última tarea completada
- **Qué se hizo:** Auditoría profunda inicial de arquitectura, funciones, seguridad, permisos, XYZ, logística y navegación. Se contrastó código vigente, documentación y esquema real de Supabase sin modificar datos ni esquema.
- **Archivos tocados:** `docs/AUDITORIA_PROFUNDA_2026-09-19.md`, `STATE.md`.
- **Cómo se probó:** inspección del árbol completo, Server Actions/API principales, módulos, roles y tablas reales de permisos/alcance en Supabase.
- **Build y tsc:** no aplica cambio de código ejecutable; la auditoría es documental. El último build de código sigue sujeto a validación independiente.

## Siguiente paso
- Completar el inventario/auditoría profunda documentado en `docs/AUDITORIA_PROFUNDA_2026-09-19.md`: referencias legacy, XYZ restante, RLS/permisos y funciones por circuito. Luego cotejar utilidad/visualización, limpiar controladamente y recién después ordenar navegación contextual y matriz de permisos.

## Auditoría estructural
- [x] Creado inventario inicial de funciones, riesgos, permisos y navegación en `docs/AUDITORIA_PROFUNDA_2026-09-19.md`.
- [ ] Completar búsqueda exhaustiva de referencias legacy antes de borrar archivos.
- [ ] Auditar RLS contra permisos funcionales y alcances existentes.
- [ ] Resolver contradicción Preview: `SUPABASE_SECRET_KEY` obsoleta y rol Operaciones ausente.
- [ ] Cotejar función → rol → permiso → alcance → siguiente paso operativo antes del rediseño de navegación.

## Pendientes conocidos
- [x] Validado que la rama de recuperación carga datos reales desde Supabase.
- [x] La incidencia OC `0,75 → 1` fue corregida y el usuario confirmó que el circuito real llegó hasta Guía/Entrega; no repetir ni alterar esa OC para probar.
- [x] Reincorporado `Ingresando…` y loader corporativo en Login y OC; Preview `a449e6c` READY.
- [ ] Validar visualmente el marco responsive transversal en escritorio, notebook, tablet y móvil.
- [ ] Evolucionar navegación incrementalmente a módulo → sección → detalle → volver, manteniendo acceso directo a otra pestaña autorizada.
- [ ] Completar la auditoría XYZ de loaders en los módulos restantes; Rutas/Despacho ya fue corregido en esta pasada.
- [ ] Limpiar las rutas operacionales de prueba duplicadas después de validar el nuevo Preview, sin tocar maestros.
- [ ] Revalidar y corregir Supervisora para que consulte solo campañas/instalaciones asignadas según permisos reales.
- [ ] En Recepción mostrar automáticamente las OC con saldo disponibles, manteniendo búsqueda por OC/proveedor.
- [ ] Reincorporar/mejorar responsive específico de Campañas, Clientes, detalle Cliente y Matriz Material × Instalación donde la validación visual lo requiera.
- [ ] Eliminar el texto explicativo inferior de la Matriz cuando se retome su mejora.
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
