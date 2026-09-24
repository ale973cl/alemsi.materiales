insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'fleet-documents',
  'fleet-documents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "fleet documents read authorized"
on storage.objects for select to authenticated
using (
  bucket_id = 'fleet-documents'
  and (has_additional_service_access('flota') or is_admin_total())
);

create policy "fleet documents insert authorized"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'fleet-documents'
  and (has_additional_service_access('flota') or is_admin_total())
);

create policy "fleet documents delete own orphan"
on storage.objects for delete to authenticated
using (
  bucket_id = 'fleet-documents'
  and owner_id = auth.uid()::text
);
