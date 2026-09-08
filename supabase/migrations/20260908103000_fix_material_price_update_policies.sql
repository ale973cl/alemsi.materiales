drop policy if exists materials_price_update_roles on public.materials;
create policy materials_price_update_roles
on public.materials
for update
to authenticated
using (public.current_app_role() in ('Admin Total','Admin','Gerencia','Finanzas'))
with check (public.current_app_role() in ('Admin Total','Admin','Gerencia','Finanzas'));

drop policy if exists activity_log_insert_own on public.activity_log;
create policy activity_log_insert_own
on public.activity_log
for insert
to authenticated
with check (public.current_app_role() is not null and actor_id = auth.uid());
