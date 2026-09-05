# Auditoría transversal del consolidado de materiales

**Fuente:** `CONSOLIDADO MATERIALES COMPLETO JUNIO - JULIO 2026 (2).xlsx`  
**Criterio:** el libro es evidencia histórica de perfiles y valorizaciones; no acredita por sí solo inventario físico, recepción ni entrega.

## Lectura X / Y / Z

- **X — territorio y contrato:** región, institución/cliente, contrato o sector e instalación.
- **Y — producto:** familia, material, variante, presentación, unidad, código de proveedor y precio fuente.
- **Z — tiempo y estado:** período indicado por la hoja, cantidad base, cero, vacío, material proporcionado por cliente, fórmula, error o dato pendiente de revisión.

Esta estructura debe persistirse de forma normalizada sin perder la celda original: `archivo → hoja → fila/columna → instalación → material → valor bruto → interpretación`.

## Inventario del libro

| Hoja | Rango usado | Filas con contenido | Materiales detectados | Columnas de instalación/bloque | Fórmulas |
|---|---:|---:|---:|---:|---:|
| TEMUCO | B1:V250 | 50 (última 50) | 46 | 17 | 31 |
| Copia de TEMUCO | B1:W249 | 52 (última 52) | 48 | 18 | 31 |
| Copia de Copia de TEMUCO | B1:W249 | 52 (última 52) | 48 | 18 | 31 |
| BIO BIO  GRAL 17-7-26 | B1:U1000 | 51 (última 53) | 47 | 8 | 32 |
| 04-8-26 | B1:E986 | 37 (última 39) | 34 | 1 | 4 |
| ÑUBLE 5-8 | A1:AE1003 | 62 (última 62) | 54 | 22 | 6 |
| LEBU 5-8 | A1:AE1003 | 61 (última 61) | 54 | 3 | 6 |
| BIO BIO | A1:AL1002 | 55 (última 56) | 51 | 29 | 16 |

## Semántica de celdas por hoja

| Hoja | > 0 | = 0 | Vacías | Cliente entrega | Otro texto |
|---|---:|---:|---:|---:|---:|
| TEMUCO | 310 | 389 | 83 | 0 | 0 |
| Copia de TEMUCO | 288 | 387 | 189 | 0 | 0 |
| Copia de Copia de TEMUCO | 288 | 387 | 189 | 0 | 0 |
| BIO BIO  GRAL 17-7-26 | 142 | 0 | 234 | 0 | 0 |
| 04-8-26 | 3 | 0 | 30 | 0 | 1 |
| ÑUBLE 5-8 | 320 | 0 | 864 | 4 | 0 |
| LEBU 5-8 | 49 | 0 | 113 | 0 | 0 |
| BIO BIO | 593 | 667 | 218 | 0 | 1 |

Interpretación obligatoria:

- `> 0`: incluido/autorizado con cantidad fuente; no equivale a stock actual.
- `0`: no utilizado/no cubierto para esa instalación; permanece en el maestro general.
- vacío: no incluido o pendiente; nunca se convierte automáticamente en entrega.
- “NO REQUIERE, el cliente entrega materiales”: estado independiente `client_provided`.
- fórmula/total: dato derivado; no debe importarse como cantidad base de una instalación.

## Hallazgos críticos de calidad

1. **Escala monetaria inconsistente.** Hay precios digitados con punto como si fuera separador de miles, pero Excel los conserva como decimales. Casos como `2.567`, `3.851`, `5.18` o `1.19` pueden quedar mil veces por debajo del valor esperado. Deben conservarse como precio fuente y marcarse `suspicious`; no normalizar automáticamente.
2. **Un error estructural confirmado.** La hoja `04-8-26` contiene `#REF!` en la fila del guante látex y una suma construida sobre referencias eliminadas.
3. **Fórmulas parciales.** Muchas filas de total no tienen fórmula, aunque filas equivalentes sí. Los totales visibles no son una base fiable para conciliación completa.
4. **Rangos usados inflados.** Varias hojas llegan a las filas 986–1003, pero la información real termina mucho antes. Importar el rango completo produciría miles de registros vacíos.
5. **Duplicidad de versiones.** Las hojas “Copia de TEMUCO” y “Copia de Copia de TEMUCO” son copias idénticas y no deben duplicar demanda.
6. **Fecha inválida.** En LEBU aparece “05 DE AGOSTO 20226”; debe conservarse como texto fuente y quedar pendiente de revisión, no transformarse en fecha de entrega.
7. **Conceptos mezclados.** El mismo libro combina perfiles de consumo, valorizaciones referenciales, totales, documentos titulados OC y períodos de uno/cuatro meses. Ninguno acredita por sí solo compra, recepción o despacho.
8. **Nombres no normalizados.** Hay erratas y variantes de instalación/institución (por ejemplo, “direccion reginoal”, “tslcahuano”), por lo que el vínculo debe pasar por una cola de cotejo y no por coincidencia automática irreversible.

### Precios fuente sospechosos detectados

- TEMUCO fila 4: precio `2.567` para Bolsa de basura CAMISETA 50 x 60 ( 100 UNIDADES)
- TEMUCO fila 5: precio `3.851` para Bolsa de basura CAMISETA 60 x 70 ( 100 UNIDADES)
- TEMUCO fila 7: precio `1.012` para Bolsa de basura 80x110 (10 unidades) Codigo Vanni: 2020303
- TEMUCO fila 8: precio `5.18` para Bolsa de basura 115 x 150 (10 Unidades) Codigo Vanni:2022312
- TEMUCO fila 17: precio `1.845` para DESINFECTANTE DETERGENTE CON AROMA ENV. 1L. WK-100
- TEMUCO fila 18: precio `1.19` para DETERGENTE LIQUIDO MULTIUSO. ENV. 1L. WK-550
- TEMUCO fila 19: precio `3.57` para 5LT MANTENEDOR PISOS DURO WK635 VIVA 5 LT. "SOLUCION"
- TEMUCO fila 21: precio `6.9` para MANTENEDOR DE PISOS VIVA. ENV. 5L. WK-635 V "CONCENTRADO"
- TEMUCO fila 22: precio `1.6` para MANTENEDOR DE PISOS VIVA. ENV. 1 LT. WK-635 V "CONCENTRADO"
- TEMUCO fila 23: precio `1.19` para LIMPIADOR CREMA TAPA FLIP TOP CITRUS ENV 500ml/750g WK-540
- TEMUCO fila 24: precio `1.547` para LIMPIADOR CREMA TAPA FLIP TOP CITRUS ENV 1Lt WK-540
- TEMUCO fila 25: precio `3.368` para CLORO, HIPOCLORITO SODIO 3%. ENV. 5L. WK-CL3
- TEMUCO fila 27: precio `1` para LAVALOZA CONCENTRADO TAPA PUSH PULL ENV. 750ml
- TEMUCO fila 28: precio `1.178` para LAVALOZA CONCENTRADO ENV. 1L. WK-750
- TEMUCO fila 29: precio `5.926` para LAVALOZA CONCENTRADO ENV. 5L. WK-750
- TEMUCO fila 34: precio `1.598` para CERA PAQUETE / SACHET PISOS COLORES
- TEMUCO fila 38: precio `1.72` para DESENGRASANTE DE ALTO PODER. ENV. 1L. WK-093
- TEMUCO fila 41: precio `1` para LUSTRAMUEBLES EMULSIONADO. ENV. 1L. WK-580
- TEMUCO fila 43: precio `9.443` para JABON 5 LT
- TEMUCO fila 44: precio `10.8` para PAPEL HIGIENICO RENDIPEL PRO 300 6 Unidades por Pack Codigo: 2362058
- TEMUCO fila 45: precio `13.15` para PAPEL HIGIENICO VANNI 300 Mt 6 Unidades por Pack Codigo: 2000704
- TEMUCO fila 46: precio `5.03` para TOALLAS DE PAPEL VANNI 190M Mts 2 Unidades por Pack Codigo: 2000707
- TEMUCO fila 47: precio `11.112` para TOALLA DE PAPEL VANNI 310 Mts 2 Unidades por Pack Codigo: 2000706
- TEMUCO fila 48: precio `2.4` para ESCOBILLON PLASTICO 30x10cm 2 COLORES CON MANGO UN
- TEMUCO fila 49: precio `4.5` para PAD ROJO
- TEMUCO fila 50: precio `4.5` para PAD NEGRO
- Copia de TEMUCO fila 4: precio `2.567` para Bolsa de basura CAMISETA 50 x 60 ( 100 UNIDADES)
- Copia de TEMUCO fila 5: precio `3.851` para Bolsa de basura CAMISETA 60 x 70 ( 100 UNIDADES)
- Copia de TEMUCO fila 7: precio `1.012` para Bolsa de basura 80x110 (10 unidades) Codigo Vanni: 2020303
- Copia de TEMUCO fila 8: precio `5.18` para Bolsa de basura 115 x 150 (10 Unidades) Codigo Vanni:2022312
- Copia de TEMUCO fila 16: precio `1.845` para DESINFECTANTE DETERGENTE CON AROMA ENV. 1L. WK-100
- Copia de TEMUCO fila 17: precio `1.19` para DETERGENTE LIQUIDO MULTIUSO. ENV. 1L. WK-550
- Copia de TEMUCO fila 18: precio `3.57` para 5LT MANTENEDOR PISOS DURO WK635 VIVA 5 LT. "LPU"
- Copia de TEMUCO fila 20: precio `6.9` para MANTENEDOR DE PISOS VIVA. ENV. 5L. WK-635 V "CONCENTRADO"
- Copia de TEMUCO fila 21: precio `1.6` para MANTENEDOR DE PISOS VIVA. ENV. 1 LT. WK-635 V "CONCENTRADO"
- Copia de TEMUCO fila 22: precio `1.19` para LIMPIADOR CREMA TAPA FLIP TOP CITRUS ENV 500ml/750g WK-540
- Copia de TEMUCO fila 23: precio `1.547` para LIMPIADOR CREMA TAPA FLIP TOP CITRUS ENV 1Lt WK-540
- Copia de TEMUCO fila 24: precio `3.368` para CLORO, HIPOCLORITO SODIO 3%. ENV. 5L. WK-CL3
- Copia de TEMUCO fila 26: precio `1` para LAVALOZA CONCENTRADO TAPA PUSH PULL ENV. 750ml
- Copia de TEMUCO fila 27: precio `1.178` para LAVALOZA CONCENTRADO ENV. 1L. WK-750

## Relaciones transversales

- `TEMUCO`, sus copias y los bloques regionales comparten materiales; sirven para formar un maestro común, no maestros separados.
- `BIO BIO GRAL` agrega cantidades y valorización por institución, mientras `BIO BIO` baja a instalaciones. El nivel detallado debe gobernar el origen y el agregado debe usarse como control de conciliación.
- `04-8-26` es un resumen/ajuste, no una matriz territorial completa.
- `ÑUBLE` y `LEBU` tienen apariencia de OC, pero también contienen matrices de perfil. Deben descomponerse en antecedente de precio, perfil por instalación y documento fuente, sin crear una OC operacional automática.

## Interpretación logística de inventarios

El Excel representa principalmente **cantidad objetivo/base por período**, no existencia física. El inventario operacional debe surgir después:

`base autorizada − remanente físico = carencia`, limitada a cero.

La carencia confirmada conserva instalación y levantamiento. Luego se consolida para abastecimiento, se asigna proveedor por línea, se convierte en OC, se recibe físicamente y recién entonces queda disponible para asignación y despacho. Una factura no aumenta por sí sola el inventario disponible; debe existir recepción. Una compra tampoco cierra la necesidad: solo la entrega completa a la instalación cierra el requerimiento.

Controles logísticos necesarios:

- saldo de OC = pedido − recibido;
- disponible de recepción = recibido − asignado a despachos;
- pendiente de despacho = requerido − despachado;
- pendiente de entrega = enviado − entregado;
- requerimiento abierto mientras cualquier cantidad de origen siga pendiente;
- precio vigente cambia solo tras validar factura/recepción, manteniendo histórico;
- alertas por quiebre, recepción parcial, diferencia factura/recepción, guía abierta y campaña incompleta.

## Decisiones de implementación

1. Guardar el archivo y cada celda interpretada en tablas de origen inmutables.
2. Separar maestro de productos, perfil contractual, inventario/recepción y demanda; no reutilizar una misma cantidad para los cuatro conceptos.
3. Exigir revisión humana para precios sospechosos, fechas inválidas, nombres ambiguos y fórmulas rotas.
4. Deduplicar hojas idénticas mediante huella del contenido y registrar la versión descartada como duplicada, sin eliminarla.
5. Mantener el cierre de campaña bloqueado hasta completar o justificar formalmente todo el universo esperado.
6. Mantener trazabilidad por usuario, rol, módulo, entidad, antes/después, motivo y documento.

## Flujo integrado recomendado

`Cliente → Contrato → Instalación → Perfil → Campaña → Levantamiento → Carencia → Consolidado → Aprobación Gerencia → Proveedor → OC → tarea Finanzas/pago → Recepción/factura → Bodega → Despacho/guía → Entrega → Pendientes → Cierre → Histórico`

El motor de correo debe ser único en infraestructura y modular en configuración: evento, plantilla, destinatarios, copias, documento, idempotencia, reintentos y trazabilidad por módulo.