# STATE — ALEMSI Materiales
## Estado actual
- **Rama activa:** `feat/servicios-adicionales-base`
- **Último commit:** este commit — `feat: cerrar circuito simple de rendiciones`.
- **Fecha:** 2026-09-21
## Última tarea completada
- Rendiciones: Borrador → Enviada → Observada/Aprobada/Rechazada → Pagada.
- Gasto primero; comprobante después con ID real del gasto. Si falla archivo, se revierte el gasto.
- Expediente muestra comprobantes privados mediante enlace firmado.
- Gerencia observa/consulta; Finanzas aprueba/rechaza/paga; Admin Total prueba todo.
- Usuario autorizado recibe acceso directo; Finanzas abre bandeja directamente.
- Expedientes guardan DEMO/ACTIVO.
- Migración Supabase `renditions_simple_end_to_end` aplicada.
- **Build:** `6b567e2` falló en Vercel por error TypeScript; corrección `c4daf15` en despliegue. **tsc local:** no disponible en esta sesión.
## Siguiente paso
- Validar build y circuito completo.
- Incorporar lector/autocompletado sobre el circuito estable.
- No avanzar Flota/Cotizaciones.
## Pendientes conocidos
- [ ] Lector/autocompletado.
- [ ] Prueba punta a punta Admin Total/Finanzas.
- [ ] Confirmar INACTIVO/DEMO/ACTIVO.
## Circuitos de Materiales que no deben alterarse
1. Campaña: instalación en campaña Abierta bloqueada hasta cierre.
2. Carencia = máximo autorizado − remanente.
3. Presupuesto alerta, nunca bloquea.
4. Recepción → Inventario → Despacho → Entrega mantiene trazabilidad.
5. Respaldos solo Admin Total.
6. Roles oficiales se mantienen.
