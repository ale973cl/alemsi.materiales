# Lectura de facturas: estado y pendiente

## Implementado actualmente

- `POST /api/finance/recognize-invoice` recibe PDF, JPG, PNG o WEBP (hasta 10 MB) y extrae datos estructurados: proveedor, RUT, folio, fecha, referencia de OC, totales y líneas.
- La recepción conectada permite buscar la OC, registrar cantidades/precios recibidos y dejar el documento en `Pendiente cotejo`.
- `reconcilePurchaseDocument` exige que un perfil autorizado escriba `CONFIRMAR`, compara cantidades, precios y total contra la OC y recién entonces genera movimientos de inventario.
- Si hay diferencia, queda el estado `Con diferencia`; no se bloquea la trazabilidad de la recepción.

## Falta para unir la lectura a la operación sin automatizar stock

1. Mostrar el resultado del reconocimiento dentro de Recepción como un borrador editable, sin grabar datos automáticamente.
2. Proponer la OC usando `purchase_order_reference`, proveedor y RUT, dejando la selección final a la persona operadora.
3. Presentar cotejo por línea: código de proveedor, descripción, cantidad, precio neto y diferencias con la OC.
4. Exigir confirmación manual explícita antes de crear/actualizar la recepción.
5. Mantener el paso ya existente de `CONFIRMAR` para cotejo y alta de stock; el reconocimiento nunca debe invocarlo ni saltarlo.

No se agregaron modelos, credenciales ni integraciones de IA en esta tarea.
