create table if not exists public.client_materials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  authorized boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, material_id)
);
create index if not exists idx_client_materials_client on public.client_materials(client_id) where authorized=true;
create index if not exists idx_client_materials_material on public.client_materials(material_id);

create table if not exists public.contract_budget_allocations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  installation_id uuid not null references public.installations(id) on delete cascade,
  allocated_net numeric not null default 0 check (allocated_net >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contract_id, installation_id)
);
create index if not exists idx_contract_budget_allocations_contract on public.contract_budget_allocations(contract_id);

alter table public.client_materials enable row level security;
alter table public.contract_budget_allocations enable row level security;
create policy "authenticated_read_client_materials" on public.client_materials for select to authenticated using (true);
create policy "authenticated_write_client_materials" on public.client_materials for all to authenticated using (exists (select 1 from public.user_profiles up where up.id=auth.uid() and up.active=true and up.role in ('Admin Total','Gerencia','Admin'))) with check (exists (select 1 from public.user_profiles up where up.id=auth.uid() and up.active=true and up.role in ('Admin Total','Gerencia','Admin')));
create policy "authenticated_read_contract_budget_allocations" on public.contract_budget_allocations for select to authenticated using (true);
create policy "authenticated_write_contract_budget_allocations" on public.contract_budget_allocations for all to authenticated using (exists (select 1 from public.user_profiles up where up.id=auth.uid() and up.active=true and up.role in ('Admin Total','Gerencia','Admin'))) with check (exists (select 1 from public.user_profiles up where up.id=auth.uid() and up.active=true and up.role in ('Admin Total','Gerencia','Admin')));

comment on table public.client_materials is 'Catalogo de materiales autorizados a nivel cliente. Los contratos seleccionan su perfil desde este catalogo.';
comment on table public.contract_budget_allocations is 'Distribucion operativa del presupuesto neto global del contrato hacia sus instalaciones. El limite contractual sigue siendo contracts.net_budget.';