-- PREPARADA PARA DEVELOPMENT. NO APLICAR EN PRODUCTION SIN REVISIÓN Y AUTORIZACIÓN.
alter view public.installation_material_profiles set (security_invoker=true);

revoke all on function public.bootstrap_admin_total() from public, anon, authenticated;
revoke all on function public.bootstrap_first_admin() from public, anon, authenticated;
revoke all on function public.apply_excel_material_profile(uuid,uuid,uuid,numeric,text,text,boolean) from public, anon, authenticated;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_app_manager() from public, anon;
revoke all on function public.is_management_role() from public, anon;
revoke all on function public.has_installation_access(uuid) from public, anon;
revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_app_manager() to authenticated;
grant execute on function public.is_management_role() to authenticated;
grant execute on function public.has_installation_access(uuid) to authenticated;
grant execute on function public.ensure_my_profile() to authenticated;

create index if not exists contract_limits_installation_idx on public.contract_limits(installation_id);
create index if not exists contract_limits_material_idx on public.contract_limits(material_id);
create index if not exists dispatch_allocations_receipt_idx on public.dispatch_allocations(receipt_line_id);
create index if not exists dispatch_allocations_supply_idx on public.dispatch_allocations(supply_allocation_id);
create index if not exists dispatch_lines_dispatch_idx on public.dispatch_lines(dispatch_id);
create index if not exists dispatch_lines_material_idx on public.dispatch_lines(material_id);
create index if not exists dispatches_campaign_idx on public.dispatches(campaign_id);
create index if not exists finance_movements_created_by_idx on public.finance_movements(created_by);

alter table public.finance_movements add column if not exists purchase_order_id uuid references public.purchase_orders(id);
create index if not exists finance_movements_purchase_order_idx on public.finance_movements(purchase_order_id);

alter table public.email_queue add column if not exists module text;
alter table public.email_queue add column if not exists event_code text;
alter table public.email_queue add column if not exists idempotency_key text;
create unique index if not exists email_queue_idempotency_uq on public.email_queue(idempotency_key) where idempotency_key is not null;

create table if not exists public.inventory_movements(
  id uuid primary key default gen_random_uuid(), material_id uuid not null references public.materials(id),
  receipt_line_id uuid references public.receipt_lines(id), dispatch_line_id uuid references public.dispatch_lines(id),
  movement_type text not null check(movement_type in ('receipt','allocation','dispatch','delivery','adjustment')),
  quantity numeric not null check(quantity>=0), signed_quantity numeric not null,
  created_by uuid references public.user_profiles(id), observation text, created_at timestamptz not null default now()
);
alter table public.inventory_movements enable row level security;
create policy "inventory_read_ops" on public.inventory_movements for select to authenticated using (public.current_app_role()=any(array['Admin Total','Gerencia','Admin','Finanzas','Bodega']));
create policy "inventory_write_bodega" on public.inventory_movements for insert to authenticated with check (public.current_app_role()=any(array['Admin Total','Admin','Bodega']));

create table if not exists public.email_module_rules(
 id uuid primary key default gen_random_uuid(), module text not null, event_code text not null,
 to_roles text[] not null default '{}', cc_roles text[] not null default '{}', template_code text,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(module,event_code)
);
alter table public.email_module_rules enable row level security;
create policy "email_rules_read_management" on public.email_module_rules for select to authenticated using (public.current_app_role()=any(array['Admin Total','Gerencia','Admin']));
create policy "email_rules_write_admin" on public.email_module_rules for all to authenticated using (public.current_app_role()=any(array['Admin Total','Admin'])) with check (public.current_app_role()=any(array['Admin Total','Admin']));

-- Control de campaña cerrada: una instalación pendiente requiere justificación formal.
create or replace function public.validate_campaign_close() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='Cerrada' and old.status is distinct from new.status and exists(
   select 1 from public.campaign_installations ci where ci.campaign_id=new.id and ci.status<>'Completada' and nullif(btrim(ci.justification),'') is null
 ) then raise exception 'No se puede cerrar una campaña con instalaciones pendientes sin justificación'; end if;
 return new;
end $$;
drop trigger if exists campaigns_validate_close on public.campaigns;
create trigger campaigns_validate_close before update on public.campaigns for each row execute function public.validate_campaign_close();
