create table if not exists public.additional_services (
  service_code text primary key,
  display_name text not null,
  status text not null default 'INACTIVO' check (status in ('INACTIVO','DEMO','ACTIVO')),
  access_mode text not null default 'AUTHORIZED' check (access_mode in ('AUTHORIZED','ALL_AUTHENTICATED')),
  public_entry_enabled boolean not null default false,
  configured_by uuid null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.additional_service_user_access (
  id uuid primary key default gen_random_uuid(),
  service_code text not null references public.additional_services(service_code) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  active boolean not null default true,
  granted_by uuid null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_code,user_id)
);

alter table public.additional_services enable row level security;
alter table public.additional_service_user_access enable row level security;

drop policy if exists additional_services_read_authenticated on public.additional_services;
create policy additional_services_read_authenticated on public.additional_services
for select to authenticated using (true);

drop policy if exists additional_services_manage_admin_total on public.additional_services;
create policy additional_services_manage_admin_total on public.additional_services
for all to authenticated using (public.is_admin_total()) with check (public.is_admin_total());

drop policy if exists additional_service_access_read_own on public.additional_service_user_access;
create policy additional_service_access_read_own on public.additional_service_user_access
for select to authenticated using (user_id = auth.uid() or public.is_admin_total());

drop policy if exists additional_service_access_manage_admin_total on public.additional_service_user_access;
create policy additional_service_access_manage_admin_total on public.additional_service_user_access
for all to authenticated using (public.is_admin_total()) with check (public.is_admin_total());

create or replace function public.has_additional_service_access(p_service_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.additional_services s
    where s.service_code = p_service_code
      and s.status in ('ACTIVO','DEMO')
      and (
        public.is_admin_total()
        or s.access_mode = 'ALL_AUTHENTICATED'
        or exists (
          select 1 from public.additional_service_user_access a
          where a.service_code = s.service_code and a.user_id = auth.uid() and a.active = true
        )
      )
  );
$$;
revoke all on function public.has_additional_service_access(text) from public;
grant execute on function public.has_additional_service_access(text) to authenticated;

insert into public.additional_services(service_code,display_name,status,access_mode,public_entry_enabled)
values
 ('rendiciones','Rendiciones','INACTIVO','AUTHORIZED',false),
 ('flota','Control de Flota','INACTIVO','ALL_AUTHENTICATED',false),
 ('cotizaciones','Cotizaciones','INACTIVO','AUTHORIZED',false)
on conflict (service_code) do nothing;
