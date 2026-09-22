create table if not exists public.user_territorial_scopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  region text not null,
  commune text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_territorial_scopes_region_not_blank check (btrim(region) <> ''),
  constraint user_territorial_scopes_commune_not_blank check (commune is null or btrim(commune) <> '')
);
create unique index if not exists user_territorial_scopes_unique_scope on public.user_territorial_scopes (user_id, lower(btrim(region)), coalesce(lower(btrim(commune)),'*'));
create index if not exists user_territorial_scopes_user_active_idx on public.user_territorial_scopes (user_id, active);
alter table public.user_territorial_scopes enable row level security;
create policy "territorial_scopes_select" on public.user_territorial_scopes for select using (user_id = auth.uid() or is_app_manager());
create policy "territorial_scopes_admin_write" on public.user_territorial_scopes for all using (current_app_role() = 'Admin Total') with check (current_app_role() = 'Admin Total');
