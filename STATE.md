# STATE — ALEMSI Materiales
## Estado actual
- **Rama activa:** ui/rendiciones-corporativa
- **Base funcional:** feat/servicios-adicionales-base
- **Último cambio funcional:** refactor visual encapsulado exclusivamente en Rendiciones.
- **Fecha:** 2026-09-21

## Última tarea completada
- Refactor visual de /rendiciones sin modificar lógica de negocio, Supabase, Server Actions, rutas ni Gemini.
- Nueva cabecera Rendiciones de Gastos, KPIs y bandeja por expediente.
- Estados visuales por badge y resumen financiero por rendición.
- Gastos responsivos con comprobante y acciones de revisión.
- Finanzas/Admin Total mantienen Aprobar/Observar/Rechazar; Gerencia mantiene solo Observar.
- Formulario conserva foto → lectura automática → corrección → guardado.
- CSS encapsulado bajo clases rendition*; no se modificó navegación ni otros módulos.
- Supabase: sin cambios. Vercel/env: sin variables nuevas. Gemini: sin cambios.

## Siguiente paso
- Validar Preview de ui/rendiciones-corporativa en escritorio y Android.
- Probar crear → leer boleta → guardar → editar → enviar → revisar → pagar.
- No extender el patrón a otros módulos sin instrucción explícita.

## Pendientes conocidos
- [ ] Validación manual UX escritorio.
- [ ] Validación manual UX Android.
- [ ] Confirmar circuito punta a punta Admin Total/Finanzas.
- [ ] Confirmar separación INACTIVO/DEMO/ACTIVO.
- [ ] Historial básico visible y saldo anterior por RUT.

## Circuitos de Materiales que no deben alterarse
1. Campaña: instalación en campaña Abierta bloqueada hasta cierre.
2. Carencia = máximo autorizado − remanente.
3. Presupuesto alerta, nunca bloquea.
4. Recepción → Inventario → Despacho → Entrega mantiene trazabilidad.
5. Respaldos solo Admin Total.
6. Roles oficiales se mantienen.
