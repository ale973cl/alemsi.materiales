# ALEMSI Materiales — Versión simple (un solo operador)

Esta rama es una copia aislada para reducir la interfaz y conservar los circuitos comprobados. No publicar en producción sin pruebas.

## Alcance exacto
1. **Clientes y contratos:** crear cliente, contrato, instalaciones, asignar plantilla de materiales según contrato e instalación; presupuesto neto informativo que alerta si se excede, sin impedir avanzar.
2. **Campañas:** iniciales o periódicas, por comuna, sector, instalaciones o período. Fecha de inicio y término de levantamientos. Enviar vínculo al encargado del levantamiento si corresponde, o utilizar plantilla ya configurada.
3. **Consolidado:** determinar cantidad autorizada, remanente en instalación, necesidad y disponibilidad neta en bodega. Separar stock disponible de carencia.
4. **Abastecimiento:** solicitudes de compra individuales por proveedor por carencia. Recepción con búsqueda de OC y, excepcionalmente, factura manual sin OC. Cotejo y alta de stock solo tras validación.
5. **Preparación, guías y entregas:** preparar individualmente por instalación ANTES de generar guía, generar guía con un clic tras preparación, asignar ruta, firmar al entregar y enviar comprobante. Identificar el archivo por guía + instalación + período/fecha de campaña.

## Flujo único
Cliente → Contrato → Instalaciones → Plantilla de materiales → Campaña → Levantamiento opcional → Consolidado → Stock disponible / Carencia → Compra opcional → Recepción y factura → Inventario → Preparar por instalación → Generar guía → Ruta → Entrega firmada → Comprobante y archivo.

## Restricciones
- Un solo operador administrativo: ocultar gestión de múltiples roles/perfiles en la interfaz final; mantener autenticación y control mínimo de acceso.
- No añadir finanzas avanzadas, multiempresa, reportes complejos o gestión de personal.
- No eliminar funciones backend hasta comprobar sus dependencias (especialmente RLS, SQL y documentos existentes).
- Precio siempre NETO en cálculos operativos (IVA separado si la factura lo informa).
- El presupuesto no bloquea. La disponibilidad física sí impide salidas superiores al stock; se muestra el faltante como advertencia operacional.
- Cada botón de detalle navega a vista corta independiente; no desplegar formularios dentro de listados.
- No escribir en main ni desplegar a Production. Los datos actuales se consideran ficticios, pero conservar estructura y referencias hasta validar la migración.

## Planilla estándar
`docs/plantilla-cliente-contrato-instalacion.csv` es una plantilla de levantamiento/importación propuesta. **No está conectada aún al importador**: el importador actual solo admite clientes (RUT) y un segundo formato de instalaciones. Implementar validación transaccional del formato unificado antes de usarlo como importación masiva.

## Criterios de aceptación
- Un cliente puede tener varios contratos y cada contrato varias instalaciones.
- Cada instalación hereda o ajusta materiales de su contrato.
- Campaña inicial y periódica convergen en el mismo consolidado.
- La cuota neta genera alerta sin impedir el procesamiento.
- Stock, órdenes y recepciones se calculan sin doble contabilización.
- Guía solo después de preparación validada y queda descargable con firma, correo y respaldo.
