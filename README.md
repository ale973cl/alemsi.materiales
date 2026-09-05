# ALEMSI Materiales — Desarrollo integrado

Versión de desarrollo que reemplaza la estructura plana de V0.1 por una navegación territorial y contractual.

## Incorporado
- Región → institución/contrato → instalaciones.
- 34 perfiles contractuales/institucionales.
- 87 instalaciones precargadas desde Excel y fuentes verificadas.
- 1.250 registros históricos importados desde TEMUCO, BIO BIO, ÑUBLE y LEBU.
- Direcciones editables y estado de verificación.
- Dirección del Trabajo Araucanía: contrato y servicios identificados en Mercado Público.
- Registro Civil Araucanía: adjudicación ALEMSI confirmada.
- PDI Araucanía: adjudicación histórica Luis Alejandro Díaz Arias confirmada; PDI Angol preparado para dos cuarteles sin inventar la segunda dirección.
- IPS Araucanía: licitaciones e instalaciones identificadas; direcciones aún en cotejo cuando corresponda.
- Solicitud por instalación con revisión física, remanente y base histórica de referencia.

## Importante
Los registros del Excel se guardan como histórico/base de pedido, no como inventario ni como entrega confirmada.

Rama objetivo: `development`. Production/main no debe modificarse sin autorización.

## Arquitectura vigente

- Next.js App Router con autenticación SSR de Supabase.
- Rol individual obtenido desde `user_profiles`; se eliminó el selector visual de perfiles.
- Dos niveles superiores: **Admin Total** y **Gerencia**. Luego perfiles operativos Admin/Operaciones, Finanzas, Bodega y Supervisora.
- Supabase es la fuente central. `localStorage` no participa en la nueva entrada operacional.
- Flujo encadenado: perfil → campaña → levantamiento → carencia → consolidado → abastecimiento → OC → Finanzas → recepción → despacho → entrega → pendientes/histórico.
- Motor de correo central con eventos y plantillas por módulo, cola, reintentos e idempotencia.

## Antes de ejecutar

Copie `.env.example` a `.env.local` y configure las claves. La clave secreta de Supabase y Resend son exclusivamente de servidor.

La migración `supabase/migrations/20260905_development_workflow_integration.sql` está preparada para una rama de desarrollo. No fue aplicada a la base principal.

## Auditoría del Excel

Consulte `docs/ANALISIS_EXCEL_LOGISTICO.md`. El Excel se interpreta como antecedente histórico/perfil, no como inventario, compra, recepción o entrega confirmada.
