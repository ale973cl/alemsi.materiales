# ALEMSI Materiales — auditoría operacional pre-merge

Base funcional: `ed7f4df4285257d68180849af7b5f1882d950ae1`  
Backup: `backup/pre-auditoria-operacional-20260923`  
Rama: `audit/cierre-operacional-pre-merge`

## Matriz de circuitos

| Circuito | Acción inicial | Estado intermedio | Estado final | Histórico | Roles | Validación servidor | Preview | Resultado |
|---|---|---|---|---|---|---|---|---|
| Campaña | Crear / cerrar | Abierta, levantamientos | Cerrada | Levantamientos e instalaciones conservados | Admin Total, Gerencia, Admin | Sí; cierre condicionado y auditado | Pendiente | REQUIERE CORRECCIÓN |
| Abastecimiento | Consultar carencia / generar OC | Consolidado, OC borrador | OC derivada/recibida | OC conservada | Gestión por capability; Supervisora consulta | Sí | Pendiente | REQUIERE CORRECCIÓN |
| Recepción con OC | Seleccionar OC y cantidades | Pendiente cotejo / recepción parcial | Recibida | Documento y líneas conservados | Receipt register; cotejo Finanzas | Sí; saldos y pertenencia de líneas | Pendiente | REQUIERE CORRECCIÓN |
| Recepción sin OC | Documento + materiales | Pendiente cotejo | Confirmada sin OC | Documento, motivo y líneas conservados | Receipt register + Finanzas/Gerencia | Sí; duplicado y justificación | Pendiente | REQUIERE CORRECCIÓN |
| Asociación OC | Proveedor + materiales exactos | Sugerencia humana | Parcial/Recibida | Asociación en receipt_lines | Receipt register | Sí; nunca por texto dudoso | Pendiente | REQUIERE CORRECCIÓN |
| Inventario | Cotejar documento | Movimientos por línea | inventory_posted | Movimientos consultables | Admin Total, Gerencia, Finanzas | Recuperación idempotente; transacción pendiente | Pendiente | REQUIERE DECISIÓN |
| Ruta | Designar / preparar / iniciar | Asignada, Preparada, En tránsito | Completada | Rutas listas | Route manage o responsable asignado | Sí; capability, asignación y estado | Pendiente | REQUIERE CORRECCIÓN |
| Entrega / guía | Registrar receptor, cantidades y firma | Parcial / observada | Entregado conforme | Entregadas + guía accesible | Delivery register y alcance | Sí; RPC existente + alcance de consulta | Pendiente | REQUIERE CORRECCIÓN |
| Supervisora | Abrir operación propia | Activos y pendientes | Cerrados/entregados | Levantamientos, rutas y guías | Solo instalaciones/territorio | Sí; URLs y API filtradas | Pendiente | REQUIERE CORRECCIÓN |
| Correo OC | Ingresar destinatario | Cola central | Enviado con PDF | email_queue/email_events | Purchase order manage | Sí; adjunto obligatorio | Pendiente | REQUIERE CORRECCIÓN |

`REQUIERE CORRECCIÓN` en esta matriz significa validación funcional pendiente en Preview; no identifica un error de compilación.

## Integridad y decisiones

- `reconcilePurchaseDocument()` no es una transacción. La recuperación por `receipt_line_id` evita duplicados en reintentos secuenciales después de una falla parcial.
- Dos cotejos realmente simultáneos aún requieren RPC/transacción y unicidad por `receipt_line_id` para garantía total. No se cambió el esquema.
- `Common.tsx` no tiene imports reales encontrados.
- `materiales-store.ts` no tiene imports entrantes, pero importa `materiales-domain.ts`.
- `materiales-domain.ts` conserva esa referencia. No se borró ningún legacy para no mezclar limpieza estructural con cierre operacional.

## Validación de perfiles

| Perfil | Resultado estático |
|---|---|
| Admin Total | Capacidades completas; servidor mantiene validaciones |
| Gerencia | Consulta/gestión según matriz; sin bypass de estado |
| Admin | Gestión operacional según capabilities |
| Finanzas | Cotejo e inventario; no recepción física por capability |
| Operaciones | Abastecimiento, OC, recepción, inventario, despacho y rutas según capabilities |
| Bodega | Recepción, inventario, despacho y rutas; sin OC/Finanzas |
| Supervisora | Consulta de abastecimiento; levantamientos, rutas, entregas y guías dentro de alcance; sin crear OC |

## Compilación

- `npx tsc --noEmit`: aprobado.
- `npm run build`: aprobado con dos advertencias preexistentes de Autoprefixer por `align-items: end` en `globals.css`; no bloquean la compilación.
- Validación manual requerida: siete sesiones reales, escritorio y Android, correo externo controlado, recepción parcial y doble clic/reintento.

