# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `fix/campanas-mobile-ui`
- **Último commit:** `HEAD` — `fix: estandarizar tarjetas de campañas en móvil`.
- **Preview desplegado:** pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-18

## Última tarea completada
- **Qué se hizo:** Se estandarizó únicamente la presentación compartida de las tarjetas de Campañas. Los botones Abrir campaña y Administrar campaña usan el mismo ancho y altura en móvil; las cuatro métricas conservan la cuadrícula 2×2 con altura, separación y alineación uniformes; se separó visualmente el número de su etiqueta. No se modificaron campañas, estados, permisos, datos ni acciones.
- **Archivos tocados:** `src/app/globals.css`, `STATE.md`.
- **Cómo se probó:** revisión estructural del componente compartido `CampaignsModule`; la regla CSS aplica a la misma vista para todos los perfiles autorizados. Prueba visual en Preview pendiente.
- **Build y tsc:** pendientes del deployment/CI de esta rama.

## Siguiente paso
- Validar en Preview las tarjetas de varias campañas en teléfono y escritorio, comprobando números de uno y dos dígitos, y confirmar que Abrir campaña y Administrar campaña mantengan dimensiones y separación consistentes.

## Pendientes conocidos
- [ ] Validar estandarización visual de Campañas en Preview móvil y escritorio.
- [ ] Validar indicador de carga del login de la rama `fix/login-indicador-carga`; no mezclar ambas tareas.
- [ ] Validar en WhatsApp que el enlace desplegado muestre `ALEMSI Materiales` y no `Demo editable`.
- [ ] Corregir el generador de links de conteo para usar el dominio estable de Production y no el hostname temporal del deployment.
- [ ] Revisar `PDI Angol · Cuartel 2`: el token público abre correctamente pero no encuentra materiales autorizados.
- [ ] Revisar Finanzas por perfil: navegación compacta, resumen/prefiltros dinámicos, facturas/pagos y OC comprometidas sin inventar estados financieros inexistentes.
- [ ] Verificar si el sistema permite hoy crear una guía de despacho excepcional para una instalación que ya tiene campaña abierta.
- [ ] Resolver/confirmar alcance operativo del rol `Operaciones` en acciones de Levantamientos y Abastecimiento/OC.
- [ ] Confirmar alerta explícita de los cuatro estados presupuestarios en Abastecimiento → OC; presupuesto alerta y nunca bloquea.
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
