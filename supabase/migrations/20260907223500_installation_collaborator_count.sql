alter table public.installations add column if not exists collaborator_count integer;
alter table public.installations drop constraint if exists installations_collaborator_count_nonnegative;
alter table public.installations add constraint installations_collaborator_count_nonnegative check (collaborator_count is null or collaborator_count >= 0);
comment on column public.installations.collaborator_count is 'Cantidad actual de colaboradoras de la instalación; parámetro editable para cálculos sugeridos de materiales por dotación.';
