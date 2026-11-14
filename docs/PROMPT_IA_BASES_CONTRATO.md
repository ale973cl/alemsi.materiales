# IA para leer bases de licitación → ALEMSI Simple

Carga las bases administrativas, técnicas y anexos. Devuelve **solo** un JSON conforme a `/ficha-contrato-ejemplo.json` (versión `alemsi-simple-2`).

**Separación indispensable:**
1. **Cliente:** entidad jurídica contratante, RUT, razón social y contactos si constan.
2. **Contrato:** código o identificación, región/cobertura, vigencia, periodicidad, referencia de facturación, cuota **neta de materiales únicamente** si se explicita, condiciones y obligaciones.
3. **Instalaciones:** identifica cada recinto mencionado con nombre, región, comuna, dirección y superficie en m², SOLO si están declarados. Si las bases solo dicen que hay 20 recintos pero no los identifican, no inventes 20 filas.
4. **Materiales del contrato:** captura el listado general de materiales, unidades, especificaciones y cantidades globales expresamente señaladas. **NO asignes materiales ni cantidades a instalaciones**, **NO dividas un total entre recintos** y **NO estimes consumos por superficie**.
5. Si las bases incluyen un cuadro de cantidades por instalación, transcríbelo en observaciones con su referencia, sin imponer todavía esas asignaciones al sistema. La distribución se realiza luego en la ficha del contrato mediante intervención humana.
6. **No inventes datos**: deja vacíos los campos desconocidos, usa `null` para cifras desconocidas y registra faltantes en `datos_no_encontrados`. No pongas `0` cuando no existe dato.
7. No confundas monto de contratación de servicios con presupuesto específico para **materiales**. La cuota es alerta, no bloqueo.
8. Documenta fuente documental/página para los principales valores, incluidas cantidades, RUT y superficies. Cuando exista contradicción, registra discrepancias en `observaciones`.
9. Mantén literalmente siglas desconocidas (por ejemplo SCO); no inventes su significado.
10. No crees clientes, contratos, materiales ni recintos fuera del documento. No incluyas datos personales no necesarios.

**Flujo operativo**:
- La IA genera la ficha desde las bases.
- El operador importa y revisa cliente, contrato, instalaciones y la lista general de materiales.
- El sistema detecta RUT existente para anexar un contrato sin duplicar al cliente.
- Los materiales quedan pendientes de distribución por instalación; la distribución se hace **después**, manualmente, considerando superficies, bases y necesidades.
- Después se realiza la primera campaña y sus levantamientos opcionales.

El importador no debe convertir una lista de materiales contractuales en movimientos de inventario ni en compras automáticas.
