# STATE — ALEMSI Materiales
<!-- Este archivo se actualiza en el MISMO commit que el cambio. Si el código avanzó y este archivo no, el commit está incompleto. -->

## Estado actual
- **Rama activa:** `fix/campanas-mobile-ui`
- **Último commit:** `HEAD` — `fix: corregir responsive de campañas clientes y matriz`.
- **Preview desplegado:** pendiente de Vercel.
- **Fecha de última actualización:** 2026-09-18

## Última tarea completada
- **Qué se hizo:** Se amplió la estandarización móvil solicitada sobre las vistas que presentaban cortes y superposiciones reales en Android. Campañas separa número y etiqueta sin sobrescritura; las tarjetas de Clientes reorganizan logo, nombre, estado, resumen y cantidad en bloques que no desbordan; el encabezado de cliente/contrato pasa a una composición vertical en móvil; y la Matriz Material × Instalación reduce la columna fija Material a 170 px en teléfono y mantiene columnas de instalación de 135 px dentro de un contenedor con desplazamiento horizontal real. La página queda contenida al ancho del teléfono y el desplazamiento lateral se reserva a la matriz.
- **Archivos tocados:** `src/app/globals.css`, `STATE.md`.
- **Cómo se probó:** revisión estructural contra `CampaignsModule`, `ClientsMasterView` y `ClientInstallationsModule`; no se modificaron componentes, acciones, datos, permisos ni reglas de negocio. Prueba visual en Preview Android y escritorio pendiente.
- **Build y tsc:** pendientes del deployment/CI de esta rama.

## Siguiente paso
- Validar en Preview Android: (1) métricas de Campañas sin letras superpuestas; (2) tarjetas de Clientes y detalle Registro Civil completamente dentro de pantalla; (3) Matriz con columna Material visible y desplazamiento horizontal suficiente para recorrer todas las instalaciones. Revisar también escritorio antes de promover.

## Pendientes conocidos
- [ ] Validar responsive de Campañas, Clientes, detalle Cliente y Matriz en Preview móvil y escritorio.
- [ ] Validar indicador de carga del login de la rama `fix/login-indicador-carga`; no mezclar su promoción.
- [ ] Validar en WhatsApp que el enlace desplegado muestre `ALEMSI Materiales` y no `Demo editable`.
- [ ] Corregir el generador de links de conteo para usar el dominio estable de Production.
- [ ] Revisar `PDI Angol · Cuartel 2`: token público abre pero no encuentra materiales autorizados.
- [ ] Revisar Finanzas por perfil sin inventar estados financieros inexistentes.
- [ ] Verificar guía de despacho excepcional para instalación con campaña abierta.
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
