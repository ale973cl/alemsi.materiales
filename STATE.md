# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `fix/roles-oficiales-y-permisos`
- **Último commit:** este commit — `refactor: aplicar autorización central en servidor`.
- **Preview desplegado:** base estable verificada `761e034` / deployment `dpl_BsCd66sRJzbzPs3t9qGyXjjgwZdM` READY; nuevo Preview de recuperación pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-21

## Última tarea completada
- **Qué se hizo:** Las Server Actions de OC, Recepción, Inventario, Despacho, Entrega y Rutas consumen ahora la misma matriz de capacidades de `src/lib/authorization.ts` que la interfaz. Se eliminaron en este circuito las listas de roles duplicadas sin cambiar permisos efectivos ni reglas de negocio. No se activó `user_module_permissions` ni se modificó Supabase.
- **Archivos tocados:** `src/lib/authorization.ts`, `src/app/purchase-order-actions.ts`, `src/app/purchase-order-email-actions.ts`, `src/app/receipt-actions.ts`, `src/app/inventory-actions.ts`, `src/app/dispatch-actions.ts`, `src/app/route-actions.ts`, `STATE.md`.
- **Cómo se probó:** equivalencia UI → capacidad → Server Action para OC, Recepción, Inventario, Despacho, Entrega y Rutas; Vercel/CI pendiente.
- **Build y tsc:** pendiente de validación del deployment/CI de este commit.

## Siguiente paso
- Ampliar la capa central a Levantamientos y Abastecimiento y validar los 7 roles de extremo a extremo.
- Después conectar `Usuarios y perfiles` a una vista de Funciones y permisos; `user_module_permissions` sigue sin ser fuente única hasta definir la semántica de agregar/quitar permisos individuales.

## Auditoría estructural
- [x] Creado inventario inicial de funciones, riesgos, permisos y navegación en `docs/AUDITORIA_PROFUNDA_2026-09-19.md`.
- [ ] Completar búsqueda exhaustiva de referencias legacy antes de borrar archivos.
- [ ] Auditar RLS contra permisos funcionales y alcances existentes. Hallazgo actual: `user_module_permissions` y `user_scope_access` tienen 0 filas; `user_installation_access` solo conserva 4 filas históricas inactivas.
- [ ] Resolver contradicción Preview/correo: `SUPABASE_SECRET_KEY` reapareció en `preview-profile-actions.ts` y `src/lib/email-delivery.ts`; rol Operaciones ausente en Preview.
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
- [x] Corregido el generador de links de conteo: `/conteo/[token]` usa siempre `https://alemsi-materiales.vercel.app`.
- [x] Diagnosticado `PDI Angol · Cuartel 2`: no hay configuración de materiales para el contrato PDI Angol en `contract_materials`, `installation_material_profiles` ni `client_materials`; requiere carga/configuración, no cambio del token.
- [ ] Revisar Finanzas por perfil sin inventar estados financieros inexistentes.
- [x] Corregido rol `Operaciones` en Levantamientos/Abastecimiento/OC: navegación, UI de OC y Server Actions quedan alineados.
- [ ] Implementar/confirmar visualmente los cuatro estados presupuestarios en Abastecimiento → OC: no existen coincidencias de esos estados en los componentes/acciones actuales de OC; la regla gerencial sí permanece documentada.
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

## Reconciliación 2026-09-19
- No se encontró un commit que reúna el supuesto fix de link firmado de Respaldos + Operaciones completo + 4 estados de presupuesto. El módulo actual de Respaldos descarga el ZIP directamente por POST/blob y no usa link firmado temporal.
- Ítem #52 era correcto: Operaciones está en navegación, pero no está autorizado en las Server Actions de Levantamientos, Abastecimiento y derivación de OC.
- Ítem #64 era correcto: la regla de 4 estados existe en METODOLOGIA/DECISIONES, pero no está materializada en la creación de OC auditada.
- METODOLOGIA.md sigue vigente: no existe “ciclo”; cualquier campaña Abierta bloquea la instalación.
- Variables usadas y no documentadas en .env.example: SUPABASE_SECRET_KEY (obsoleta; 2 archivos), VERCEL_ENV, EMAIL_ALLOWED_PERSONAL, GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN, GOOGLE_DRIVE_ROOT_FOLDER_ID, GOOGLE_DRIVE_ROOT_FOLDER_NAME y SUPABASE_ANON_KEY en Edge Functions. Las variables de Google Drive/SMTP se investigan; no se corrigen en esta tarea.
