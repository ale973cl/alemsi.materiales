# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `recovery/estable-login-9c0a88a`
- **Último commit:** este commit — `feat: unificar carga corporativa operacional`.
- **Preview desplegado:** el Preview anterior del commit `a449e6c` está READY; el Preview de este commit queda pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-19

## Última tarea completada
- **Qué se hizo:** Se inició la unificación transversal de esperas reales con el indicador corporativo ALEMSI. Inventario, Recepción y Finanzas reutilizan el mismo componente de cuatro rombos para cargas; los guardados de conteo y recepción bloquean doble clic y muestran texto contextual. No se modificaron reglas de negocio, permisos ni esquema Supabase.
- **Archivos tocados:** componente UI de carga, Inventario, Recepción, Finanzas, estilos globales y STATE.md.
- **Cómo se probó:** revisión estática de estados loading/saving y operaciones async. Validación de Preview pendiente tras este commit.
- **Build y tsc:** pendientes del deployment/CI; no se declaran aprobados hasta verificarlos.

## Siguiente paso
- Validar el nuevo Preview en escritorio/notebook/móvil y continuar incrementalmente con navegación contextual módulo → sección → detalle → volver, sin duplicar módulos. Corregir primero los casos donde una acción abre contenido fuera del área visible. Después resolver el acceso de Supervisora a sus campañas/instalaciones y la lista visible de OC disponibles en Recepción.

## Pendientes conocidos
- [x] Validado que la rama de recuperación carga datos reales desde Supabase.
- [x] La incidencia OC `0,75 → 1` fue corregida y el usuario confirmó que el circuito real llegó hasta Guía/Entrega; no repetir ni alterar esa OC para probar.
- [x] Reincorporado `Ingresando…` y loader corporativo en Login y OC; Preview `a449e6c` READY.
- [ ] Validar visualmente el marco responsive transversal en escritorio, notebook, tablet y móvil.
- [ ] Evolucionar navegación incrementalmente a módulo → sección → detalle → volver, manteniendo acceso directo a otra pestaña autorizada.
- [ ] Garantizar que formularios, loaders, mensajes y resultados de acciones queden destacados dentro del área visible.
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
