# DECISIONES — ALEMSI Materiales

Archivo **solo-agregar**. No reescribir ni borrar decisiones anteriores; si una decisión cambia, agregar una nueva entrada que indique qué reemplaza.

Formato: `fecha | decisión tomada | por qué | alternativa descartada`

| Fecha | Decisión tomada | Por qué | Alternativa descartada |
|---|---|---|---|
| 2026-09-17 (consolidación) | El presupuesto excedido solo genera alerta gerencial y nunca bloquea abastecimiento/OC. | El control presupuestario debe informar y escalar sin detener una necesidad operacional válida. | Bloqueo duro por presupuesto excedido. |
| 2026-09-17 (consolidación) | La transferencia del proyecto Supabase al cliente se realiza mediante **Transfer Project** nativo de Supabase. | Mantiene continuidad técnica y propiedad sin recrear manualmente la base. | Migración manual/recreación del proyecto como método principal de transferencia. |
| 2026-09-17 (consolidación) | Mantener `middleware.ts` en vez de `proxy.ts` mientras el proyecto permanezca en Next.js 15. | Es la convención compatible con la versión actual del framework usada por el proyecto. | Migrar anticipadamente a `proxy.ts` sin actualización de Next.js que lo justifique. |
| 2026-09-17 (consolidación) | Usar una única variable de servidor `SUPABASE_SERVICE_ROLE_KEY`. | Evita claves paralelas, ambigüedad de configuración y diferencias entre entornos. | Varias variables equivalentes para la misma service role key. |
| 2026-09-17 (consolidación) | Los maestros se presentan mediante una sola entrada funcional unificada. | Evita navegación duplicada y pérdida de acciones entre pantallas equivalentes. | Múltiples accesos/maestros paralelos que llevan al mismo propósito. |
| 2026-09-17 | `STATE.md` es el punto de continuidad técnica y se actualiza en el mismo commit de cada tarea. | Separar memoria funcional de estado técnico verificable y permitir continuidad entre sesiones. | Depender del historial del chat o de memoria para reconstruir el último estado. |
