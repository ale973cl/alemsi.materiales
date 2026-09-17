# METODOLOGÍA — ALEMSI Materiales

Documento de consulta rápida. El estado puntual vive en `/STATE.md`; las decisiones históricas se agregan en `/docs/DECISIONES.md`.

## 1. Jerarquía
`Cliente → Contrato → Instalación → Materiales`

- Un cliente puede tener varios contratos independientes.
- Cada contrato tiene sus propias instalaciones, materiales, presupuesto y campañas.
- No duplicar clientes por licitación/contrato.
- La configuración de materiales por instalación define cantidades, periodicidad, límites y excepciones.

## 2. Reglas de negocio no negociables
- **Carencia:** `máximo autorizado − remanente físico`.
- **Límite duro:** no permitir solicitar más que la carencia calculada.
- **Presupuesto:** control gerencial; estados Dentro de presupuesto / Cerca del límite / Sobre presupuesto / Presupuesto no configurado.
- **Presupuesto excedido:** ALERTA, nunca bloqueo de campaña, abastecimiento u OC.
- **Campañas:** una instalación no puede estar en dos campañas activas del mismo ciclo; bloquear en interfaz y revalidar en servidor antes de crear.
- **Inventario:** existencia deriva de movimientos reales; todo ajuste debe quedar trazado.
- **Entrega parcial:** genera pendiente; la guía debe reflejar solo lo realmente entregado.
- **Datos reales:** no inventar clientes, contratos, instalaciones, materiales, precios, condiciones de pago ni relaciones.

## 3. Flujo operativo
`Perfil de materiales → Campaña → Toma/Levantamiento → Carencia → Consolidado → Abastecimiento → OC → Recepción/Factura → Inventario → Despacho → Guía → Entrega → Pendientes → Histórico/Costos → Finanzas/Reportes`

## 4. Roles y pestañas
Fuente de permisos vigente: `visibleModules()` / `roleModules` del código actual. Todo cambio debe validarse contra los 6 roles.

- **Admin Total:** todos los módulos, incluido Respaldos.
- **Gerencia:** Inicio · Clientes/Contratos · Maestro · Cotejo/Diferencias · Consolidado/Abastecimiento · Kits · OC · Pendientes · Histórico/Costos.
- **Admin:** todos los módulos operativos y administrativos salvo Respaldos.
- **Finanzas:** Inicio · OC · Ingreso Mercadería · Pendientes · Histórico/Costos.
- **Bodega:** Inicio · Ingreso Mercadería · Guías/Despachos · Pendientes · Histórico/Costos.
- **Supervisora:** Inicio · Levantamiento · Cotejo/Diferencias · Pendientes · Histórico/Costos.

Regla: cada rol ve solo sus pestañas autorizadas y ninguna ruta autorizada puede caer en pantalla genérica.

## 5. Lenguaje visual
- Texto principal: `#173650` / `#0b2f4a`.
- Acento teal: `#5daea2` / `#79bdb1`.
- Bordes: `#c8dce8`.
- Fondo: blanco, con superficies claras.
- Tarjetas: radio `12–14px`.
- Botones/píldoras: radio `999px` cuando sean acciones o estados tipo cápsula.
- Títulos y badges: peso `700–800`.
- Estados: sin campaña = gris; en campaña = amarillo/naranjo; toma en proceso = azul; toma completada = turquesa/verde; parcial = combinado.
- Mantener interfaz clara, pocos clics, textos en español simple y funcionamiento móvil.

## 6. Reglas de trabajo
- Leer `STATE.md` antes de tocar código.
- Verificar rama, último commit y Preview antes de modificar; GitHub/Vercel prevalecen sobre memoria conversacional.
- No reconstruir la aplicación.
- No reemplazar módulos completos para resolver cambios puntuales.
- No duplicar botones, pantallas, rutas, consultas ni circuitos.
- Leer el archivo actual y verificar su SHA antes de modificarlo.
- No cambiar esquema de Supabase sin autorización explícita.
- Supabase es la única fuente de datos de negocio.
- Un commit por tarea.
- `STATE.md` se actualiza en el MISMO commit que cualquier cambio de código.
- No tocar `main`; el dueño revisa y fusiona.
- Antes de borrar un archivo, buscar referencias reales relativas y por alias; si tiene referencias, no borrar.
- Probar el circuito completo afectado y los roles relacionados.
- Verificar móvil cuando la tarea toque interfaz.
- Antes de cerrar: `npm run build` y `npx tsc --noEmit` deben pasar limpios.
- Si código avanzó y `STATE.md` no, la tarea está incompleta.

## 7. Continuidad
Cuando el usuario diga `seguimos` o `aplica la metodología maestra`, leer primero `STATE.md` y continuar desde su siguiente paso. Toda decisión técnica o de negocio nueva se agrega a `docs/DECISIONES.md` antes de cerrar la tarea.
