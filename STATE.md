# STATE — ALEMSI Materiales
## Estado actual
- **Rama activa:** `feat/servicios-adicionales-base`
- **Último cambio funcional:** Rendiciones con lector OpenRouter + planilla/revisión por línea.
- **Fecha:** 2026-09-21

## Última tarea completada
- Segunda reparación del guardado de Rendiciones: eliminado useActionState del formulario de gasto para evitar la excepción cliente posterior al submit en Next.js 15.5.
- El submit ahora invoca la Server Action de forma controlada, mantiene la pantalla y muestra éxito/error sin derribar /rendiciones.
- Reparado guardado de gastos en Rendiciones: los errores de Storage/DB ya no derriban la pantalla; se muestran dentro del formulario.
- El formulario usa estado de Server Action y confirma éxito/error sin navegar a una pantalla de excepción.
- Se mantiene rollback del gasto si falla el guardado o vínculo del comprobante.
- Comprobante pasa a ser el primer paso del gasto.
- Lector visual usa `OPENROUTER_API_KEY` solo en servidor y `openrouter/free` con entrada de imagen.
- Lectura propone fecha, tipo/número de documento, proveedor, RUT, descripción y total; el usuario siempre puede corregir.
- Imagen original se conserva y queda accesible con “Ver comprobante”.
- Expediente muestra gastos en formato planilla.
- Usuario puede editar líneas en Borrador/Observada.
- Finanzas/Admin Total aprueban, observan o rechazan por línea; Gerencia puede observar.
- Una línea observada devuelve la rendición al usuario para corrección.
- “Enviar a Finanzas” queda deshabilitado sin gastos y la validación ya no genera el error 500 observado.
- Migración Supabase `rendition_expense_line_review` aplicada: `review_status` por gasto.
- **Build:** deployment final Vercel `dpl_7FWS5qWssQ44YvP6sZFa8mhYSwdF` en BUILDING al cerrar esta actualización. `tsc --noEmit` local no disponible en esta sesión.

## Siguiente paso
- Confirmar deployment READY del commit a2d6dfd y repetir guardar gasto en PC y Android.
- Prueba real desde Android: foto → “Analizando comprobante…” → datos autocompletados → corregir → guardar → recargar → Ver comprobante.
- Luego enviar y probar observación/aprobación por línea y pago.
- No avanzar Flota/Cotizaciones.

## Pendientes conocidos
- [ ] Confirmar calidad real de lectura con boleta/factura chilena.
- [ ] Confirmar circuito punta a punta Admin Total/Finanzas.
- [ ] Confirmar separación INACTIVO/DEMO/ACTIVO en datos/reportes.
- [ ] Historial básico visible y saldo anterior por RUT siguen pendientes de cierre.

## Circuitos de Materiales que no deben alterarse
1. Campaña: instalación en campaña Abierta bloqueada hasta cierre.
2. Carencia = máximo autorizado − remanente.
3. Presupuesto alerta, nunca bloquea.
4. Recepción → Inventario → Despacho → Entrega mantiene trazabilidad.
5. Respaldos solo Admin Total.
6. Roles oficiales se mantienen.
