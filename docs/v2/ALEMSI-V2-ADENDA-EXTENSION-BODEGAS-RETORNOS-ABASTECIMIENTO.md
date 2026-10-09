# ALEMSI Materiales V2 — Adenda funcional: Bodegas, Retornos y Abastecimiento Directo

**Estado:** decisiones funcionales expresadas por el propietario; pendiente contraste técnico con código, esquema y matriz V2.
**Alcance:** capacidades de la extensión V2; no sustituye ni modifica por defecto Materiales Core.
**Referencia histórica:** ALEMSI-V2-DEFINICION-FUNCIONAL.md (documento externo al árbol de esta rama, pendiente de incorporar/verificar).

## 1. Arquitectura y separación Core / extensión
Materiales Core conserva sus maestros y circuitos V1 operativos. La extensión V2 incorpora bodegas virtuales, inventario diferenciado, retornos, transferencias y abastecimiento directo por factura. Reutiliza interfaces autorizadas de clientes, contratos, instalaciones, materiales, proveedores, usuarios, inventario y documentos. No duplicar maestros, existencias ni movimientos. Al deshabilitar la extensión, Core continúa funcionando. La separación funcional no exige bases de datos independientes; verificar arquitectura real antes de decidir persistencia. Rendiciones y Control de Flota permanecen extensiones independientes.

## 2. Inventarios diferenciados
- **Consumibles:** productos para uso/consumo operacional.
- **No consumibles/reutilizables:** aspiradoras, abrillantadoras, carros moperos, mangos telescópicos, contenedores industriales, computadores y demás equipos recuperables.
- Compartir catálogo sin crear otro producto por cambio de ubicación. Separar reglas y vistas; estructura técnica pendiente de revisión.
- Equipos pueden requerir identificador individual y estado físico; catálogos definitivos pendientes.

## 3. Ubicaciones y bodegas virtuales
- **Supervisor/sucursal:** custodia de consumibles, EPP, papelería, uniformes y equipos; son existencias reasignables, no consumo personal. Registrar entradas, salidas, transferencias y retornos con origen, destino, material, cantidad, fecha y responsable.
- **Instalación del cliente:** consumibles entregados y confirmados dejan de estar disponibles para ALEMSI; no exigir consumo diario. Equipos reutilizables conservan ubicación y trazabilidad, susceptibles de retorno.
- **Central/otras bodegas:** movimientos entre custodios son transferencias, no consumo. Nunca simular tránsito por Central si proveedor entregó directamente a instalación.

## 4. Extensión independiente de Retornos y GR
Pantallas propias de consulta, retiro, emisión de **GR — Guía de Retorno**, estados y recepción, integradas al inventario común.
Flujo: origen (instalación o bodega virtual) → bienes/cantidades → destino/motivo → evidencia/estado → GR → traslado pendiente → **confirmación de recepción física por responsable autorizado** → movimiento único al inventario destino.
- Emitir GR no incrementa por sí solo stock disponible de destino.
- La confirmación ejecuta el movimiento automáticamente, sin un segundo registro manual de retorno.
- Equipos averiados quedan trazados pero no disponibles para reasignación.
- Registrar diferencias, responsable, fotografías y evidencia. Prevenir doble ejecución/idempotencia.
- Motivos estructurados y catálogo de identificadores/estados: pendientes de aprobación definitiva.

## 5. Extensión de abastecimiento directo por factura
No reemplaza campañas, carencias, consolidación, OC ni recepción ordinaria del Core.
**Interfaz principal:** cargar factura → lector reconoce proveedor, folio, fecha, productos, cantidades y valores → usuario verifica → pregunta **«¿Dónde se entregaron los productos?»**.
Alternativas iniciales:
1. **Directamente a una instalación del cliente:** seleccionar cliente → contrato → instalación; vincular factura/productos; registrar entrega directa proveedor→instalación sin entrada ficticia a Central; generar o vincular guía y solicitar confirmación.
2. **Bodega Central ALEMSI:** confirmar recepción física y actualizar inventario.
La arquitectura admite bodegas virtuales de supervisores, pero la ubicación de esta opción en la interfaz queda pendiente; no imponer tercer circuito obligatorio.
Reglas: factura no acredita recepción; OC opcional cuando compra es legítimamente sin OC, vinculable si existe; destino siempre verificado por persona; controlar duplicados; facturas con destinos múltiples quedan como caso por resolver, no requisito visual aprobado.

## 6. Guía, firma y expediente de entrega directa
Asociar proveedor, factura, productos, cliente, contrato, instalación y guía. Enlace seguro por entrega para que receptor pueda verificar cantidades, informar diferencias y confirmar desde Android con identidad, fecha y firma/evidencia.
Estados conceptuales: emitida/pendiente, recibida, recibida con diferencias; contrastar nomenclatura real.
Expediente consultable por cliente, contrato, instalación, factura y guía. Usuarios autorizados podrán descargar y reenviar respaldo a central del cliente; receptor accede a comprobante mediante mecanismo seguro. Firma dibujada no equivale automáticamente a firma electrónica avanzada.

## 7. Responsabilidades de la extensión
- **Core:** maestros y flujos básicos protegidos.
- **Bodegas y Distribución:** custodias, ubicaciones, existencias reasignables y transferencias.
- **Abastecimiento Directo:** lectura de factura, destino real, compra/entrega directa y vínculos.
- **Retornos:** retiro, GR, recepción y movimientos de retorno.
- **Servicio documental compartido:** confirmación, firma/evidencia, consulta y reenvío.
Estas son capacidades funcionales; número de extensiones técnicas, tablas, API y permisos aún no aprobados.

## 8. Restricciones
No modificar main/Production, credenciales, datos reales ni módulos V1. Contrastar antes de implementar con STATE.md, AGENTS.md, auditoría V1, decisiones V2, matriz de integración y código/esquema. No presentar propuesta como funcionalidad implementada. Mantener carencia = máximo autorizado − remanente físico; solicitud nunca mayor a carencia; presupuesto gerencial no bloqueante. No inventar valorización ni FIFO/LIFO/FEFO.

## 9. Casos de aceptación
1. Supervisor recibe 20 resmas: conserva 20 reasignables, no consumidas.
2. Entrega 5 con guía: reduce su custodia, registra entrega, sin consumo diario.
3. Transfiere 8 a otro supervisor: una salida y una entrada, una sola ejecución.
4. Retorna 7 a Central: aumenta stock de destino al confirmar recepción física, no al emitir GR.
5. Abrillantadora averiada: ubicación y estado no disponible, sin producto duplicado.
6. Proveedor entrega directo: factura y guía vinculadas, sin tránsito ficticio por Central.
7. Receptor confirma por enlace: identidad, fecha, cantidades, evidencia y respaldo reenviable.
8. Extensión deshabilitada: Core mantiene operaciones previas sin pérdida de datos.

## 10. Pendientes y condición de aprobación
Verificar arquitectura, permisos y modelo de movimientos; identificación individual y estados; catálogo de motivos; recepción en bodega virtual desde factura; facturas multidestino; firma y requisitos jurídicos; matriz completa de extensiones V2. Esta adenda documenta decisiones funcionales, **no autoriza migraciones ni implementación automática**.
