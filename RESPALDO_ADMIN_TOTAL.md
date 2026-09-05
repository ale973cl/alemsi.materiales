# ALEMSI Materiales — Respaldo Admin Total

Este paquete incorpora el módulo **13. Respaldos**, visible únicamente al seleccionar **Admin Total**.

## Variables obligatorias en Vercel
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto ALEMSI Materiales.
- `SUPABASE_URL`: opcional si ya existe la anterior; puede usar la misma URL.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key. SOLO servidor. Nunca usar prefijo NEXT_PUBLIC.
- `BACKUP_ADMIN_TOKEN`: clave privada que se solicita al generar el respaldo.

## Contenido del respaldo
El ZIP descargado contiene:
- `manifest.json`
- `full_backup.json`
- carpeta `csv/` con un CSV por cada tabla operacional.

El generador lee la base en páginas de 1.000 registros, registra el evento en `activity_log` y no modifica, restaura ni elimina datos operacionales.

## Regla de seguridad
No publicar `SUPABASE_SERVICE_ROLE_KEY` en código, GitHub ni variables `NEXT_PUBLIC_*`.
