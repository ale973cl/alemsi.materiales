-- ALEMSI Materiales | Provisionar SOLO en Supabase de PRUEBA antes del test integral.
-- NO ejecutar sobre el proyecto de producción ni compartir públicamente los archivos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('receipt-documents','receipt-documents',false,8388608,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Supabase Storage aplica RLS sobre storage.objects.
create policy "alemsi_receipts_select" on storage.objects
for select to authenticated using (
 bucket_id='receipt-documents' and exists (
  select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.active=true
  and p.role in ('Admin Total','Gerencia','Admin','Bodega','Finanzas')
 )
);
create policy "alemsi_receipts_insert" on storage.objects
for insert to authenticated with check (
 bucket_id='receipt-documents' and exists (
  select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.active=true
  and p.role in ('Admin Total','Admin','Bodega')
 )
);
-- No UPDATE/DELETE de originales: una factura registrada no se sobrescribe.
