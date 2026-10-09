# ALEMSI Materiales — Reglas de trabajo

## Inicio obligatorio

Antes de cualquier tarea: (1) leer completo `AGENTS.md`, (2) leer completo `STATE.md`, (3) confirmar rama activa, (4) confirmar SHA y (5) ejecutar `git status`. No asumir que una rama es correcta solo por su nombre.

Si `STATE.md` contradice Git, Git determina el estado técnico real. Reportar la discrepancia antes de trabajar.

## Proyecto

ALEMSI Materiales es un ERP interno de control operacional de materiales. Repositorio: `ale973cl/alemsi.materiales`.

Stack: Next.js App Router, TypeScript, Vercel y Supabase PostgreSQL como fuente de datos.

## Dominio

Jerarquía: Cliente → Contrato/Licitación → Instalaciones → Materiales.

Flujo operacional: Perfil de materiales → Campaña → Toma/Levantamiento → Carencia → Consolidado → Abastecimiento → Orden de Compra → Recepción/Factura → Inventario → Despacho → Guía → Entrega.

No tratar ALEMSI como sistema de valorización de inventario. No introducir FIFO, LIFO, FEFO, COGS, EOQ ni costeo promedio salvo solicitud explícita.

## Reglas críticas de negocio

- **Carencia:** Máximo autorizado − Remanente físico. El personal de terreno no puede solicitar más que la carencia; es un límite duro.
- **Presupuesto:** control GERENCIAL; nunca bloquea una campaña ni una Orden de Compra. Estados: Dentro de presupuesto, Cerca del límite, Sobre presupuesto y Presupuesto no configurado.
- **Campañas:** mientras una instalación pertenezca a cualquier campaña `Abierta`, no puede agregarse a otra campaña, independientemente del período. Debe existir bloqueo en interfaz y revalidación en servidor antes de crear la campaña.

No reinterpretar estas reglas.

## Usuarios e interfaz

Los usuarios finales no son técnicos. Usar español claro, pocos clics, estados visibles y evitar jerga técnica visible. Funcionar en escritorio y correctamente en teléfonos Android, evitar scroll horizontal y priorizar legibilidad y operación rápida. Una función correcta pero confusa debe considerarse incompleta.

## Git y seguridad

Nunca trabajar directamente sobre `main`. Representa producción estable y no debe modificarse salvo instrucción explícita del propietario.

Una tarea → una rama → un commit lógico. No hacer merge automáticamente: el propietario revisa y decide los merges.

No realizar force push, reset destructivo, rebase destructivo ni cambios en Production sin autorización explícita.

## Eliminación de archivos

Antes de eliminar cualquier archivo: buscar imports relativos, imports mediante alias, referencias directas y referencias indirectas relevantes; informar los resultados. Si existen referencias, no eliminar sin autorización.

## STATE.md

`STATE.md` es la memoria operacional del repositorio. Debe contener como mínimo: objetivo actual, rama, base, último paso completado, siguiente paso, pendientes y validaciones.

Al terminar una tarea que modifica el repositorio, actualizar `STATE.md` y agregarlo al mismo commit.

## Validación obligatoria

Antes de declarar terminado cualquier cambio de código, ejecutar `npm run build` y `npx tsc --noEmit`; ambos deben pasar. Si no se ejecutaron, indicarlo explícitamente. No inferir que un deployment exitoso equivale a haber ejecutado ambos comandos.

## Supabase

No cambiar el esquema de Supabase sin autorización explícita. La variable privada válida es `SUPABASE_SERVICE_ROLE_KEY`; `SUPABASE_SECRET_KEY` está obsoleta para este proyecto.

## Next.js

El proyecto utiliza Next.js 15.5.x. El archivo raíz de sesión debe ser `middleware.ts`. No migrarlo a `proxy.ts` por convenciones de Next.js 16.

## Funcionalidad existente

No reconstruir, rediseñar, eliminar u "optimizar" funcionalidad existente sin que la tarea lo requiera. Antes de modificar una regla existente, identificar dónde está implementada, quién la consume, qué proceso depende de ella y qué podría romperse.

## Roles

No asumir una lista de roles desde documentación histórica; consultar la implementación real, que es la fuente de verdad. Históricamente se han utilizado Admin Total, Gerencia, Admin, Finanzas, Bodega, Supervisora y Operaciones. Todo cambio de navegación o permisos debe validarse contra los roles reales.

## ALEMSI V2

ALEMSI V2 está en etapa de análisis. V1 es inicialmente la fuente funcional de verdad. "V2" NO autoriza a borrar V1, reescribir automáticamente módulos, cambiar Supabase, crear tablas, eliminar funcionalidades ni sustituir reglas de negocio.

Antes de construir V2: (1) auditar V1, (2) recuperar funcionalidad real, (3) mapear procesos, (4) mapear pantallas, (5) identificar dependencias, (6) definir arquitectura, (7) diseñar y (8) implementar progresivamente.

Procesos propuestos, como hipótesis de trabajo hasta que la auditoría funcional los confirme:

- P01 Campañas
- P02 Levantamientos / Toma de Datos
- P03 Consolidado
- P04 Abastecimiento
- P05 Órdenes de Compra
- P06 Recepción
- P07 Inventario
- P08 Despacho / Guías / Entrega
- P09 Finanzas
- P10 Maestros
- P11 Rendiciones
- P12 Flota
- P13 Administración / Auditoría / Respaldos

P00 Inicio / Dashboard General se definirá posteriormente utilizando datos reales provenientes de los procesos.

## Diseño V2

Diseñar proceso completo por proceso completo: P01.00 → P01.01 → P01.02 → … → P01 aprobado; después P02.00 → P02.01 → … No saltar arbitrariamente entre procesos.

Stitch define presentación visual; el código real define funcionalidad; Supabase define datos. No inventar funcionalidad para satisfacer un diseño.

## Línea funcional de referencia para auditoría V2

Base general seleccionada: `origin/fix/login-latencia-global`.

SHA base: `3ae46afbb8e246e8f9756cdd86bd1a83a02254ca`.

Los experimentos `ui/campanas-mobile-stitch-pilot` y `ui/campanas-responsive-stitch-escritorio` NO forman parte de la base funcional.

Flota contiene desarrollo divergente y debe analizarse como línea complementaria para no perder funcionalidad.
