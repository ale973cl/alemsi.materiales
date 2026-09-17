# METODOLOGÍA — ALEMSI Materiales

Documento compacto de reglas permanentes. El estado puntual vive en `/STATE.md`; las decisiones históricas viven en `/docs/DECISIONES.md`.

## 1. Jerarquía funcional
`Cliente → Contrato → Instalación → Materiales configurados`.

- Cliente: identidad legal; RUT prevalece sobre similitud de nombre.
- Contrato: define marco económico/operativo.
- Instalación: unidad física operativa del contrato; nombre solo no es identificador suficiente.
- Materiales: catálogo maestro + configuración por instalación (cantidad, periodicidad, límite, excepción).

## 2. Reglas de negocio no negociables
- **Carencia:** `máximo autorizado − remanente utilizable`; es límite duro. Nunca permitir solicitar sobre la carencia calculada.
- **Presupuesto:** exceder presupuesto genera **alerta gerencial**, nunca bloqueo automático de abastecimiento/OC.
- **Campañas:** una instalación no puede pertenecer a dos campañas activas al mismo tiempo.
- **Inventario:** disponibilidad deriva de movimientos reales; no editar stock silenciosamente. Todo ajuste debe ser trazable.
- **Entrega:** una entrega parcial genera saldo pendiente; la guía refleja solo lo efectivamente entregado.
- **Datos:** no inventar clientes, contratos, instalaciones, precios, plazos de pago ni relaciones. Leer fuente real.

## 3. Flujo operativo completo
`Cliente/Contrato/Instalación → Configuración materiales → Campaña → Levantamiento/remanente → Carencia → Cotejo → Consolidado/Abastecimiento → OC → Recepción → Inventario → Guías/Despacho → Preparar → En tránsito → Entrega total/parcial → Pendientes → Histórico/Costos → Finanzas/Reportes`.

## 4. Roles y visibilidad actual
Fuente vigente: `visibleModules()` en `src/lib/materiales-store.ts`.

- **Supervisora:** Inicio · Levantamiento · Cotejo/Diferencias · Pendientes · Histórico/Costos.
- **Gerencia:** Inicio · Clientes/Contratos · Maestro · Cotejo/Diferencias · Consolidado/Abastecimiento · Kits · OC · Pendientes · Histórico/Costos.
- **Finanzas:** Inicio · OC · Ingreso Mercadería · Pendientes · Histórico/Costos.
- **Bodega:** Inicio · Ingreso Mercadería · Guías/Despachos · Pendientes · Histórico/Costos.
- **Admin:** todos los módulos operativos y administrativos salvo Respaldos.
- **Admin Total:** todos los módulos, incluido Respaldos.

Si se cambia la matriz de permisos, actualizar este documento y probar los 6 roles en la misma tarea.

## 5. Lenguaje visual
Base vigente en `src/app/globals.css`.

- Azul marino corporativo: cabeceras, navegación y acciones principales (`#073b5c` / `#0b2740`).
- Turquesa/verde ALEMSI: selección, progreso, estados activos y acentos (`#159a9c`, mint `#71d5ce`).
- Fondo general claro (`#f3f7f8`); paneles/tarjetas blancas.
- Peligro/error: rojo (`#b42318`).
- Advertencia/pendiente: amarillo suave; éxito/confirmado: verde suave; información/activo: turquesa suave.
- Radios: controles ~8–10 px; tarjetas/paneles ~12–14 px; pills/estados redondeados tipo cápsula.
- Evitar fondo negro. Mantener legibilidad móvil y jerarquía sobria/técnica.

## 6. Reglas de trabajo
- Leer `STATE.md` antes de tocar código.
- Verificar rama, HEAD y Preview; GitHub/Vercel ganan sobre memoria conversacional.
- No reconstruir la aplicación ni reemplazar módulos completos para resolver cambios puntuales.
- No duplicar botones, rutas, pantallas, fuentes de datos ni circuitos.
- Leer archivo actual y SHA antes de modificarlo.
- Un cambio mínimo y trazable por tarea.
- **Un commit por tarea**; `STATE.md` se actualiza en ese mismo commit.
- No tocar `main` ni Production salvo instrucción expresa.
- Mantener Supabase como fuente real de negocio; evitar estados paralelos locales.
- Probar circuito completo afectado, no solo el componente modificado.
- Verificar móvil cuando la tarea toque UI.
- Si build o tsc fallan, la tarea no se considera cerrada.

## 7. Criterio de cierre
Una tarea termina cuando: cambio requerido funciona, persiste, deja el estado posterior correcto, no rompe circuitos relacionados, build/tsc pasan, Preview queda validado y `STATE.md` se actualiza en el mismo commit.
