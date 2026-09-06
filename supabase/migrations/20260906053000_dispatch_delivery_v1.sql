-- Despacho y Entrega de Materiales V1. Cambios aditivos sobre tablas existentes.
create sequence if not exists public.dispatch_internal_number_seq;

alter table public.dispatches add column if not exists contract_id uuid references public.contracts(id);
alter table public.dispatches add column if not exists internal_number text;
alter table public.dispatches add column if not exists observations text;
alter table public.dispatches add column if not exists recipient_rut text;
alter table public.dispatches add column if not exists recipient_role text;
alter table public.dispatches add column if not exists recipient_phone text;
alter table public.dispatches add column if not exists recipient_signature text;
alter table public.dispatches add column if not exists created_by uuid references public.user_profiles(id);
alter table public.dispatches add column if not exists delivered_by uuid references public.user_profiles(id);
alter table public.dispatches add column if not exists prepared_at timestamptz;
alter table public.dispatches add column if not exists ready_at timestamptz;
alter table public.dispatches add column if not exists in_transit_at timestamptz;
alter table public.dispatches add column if not exists cancelled_at timestamptz;
alter table public.dispatches add column if not exists cancellation_reason text;
alter table public.dispatches add column if not exists document_url text;
alter table public.dispatches add column if not exists document_id text;
alter table public.dispatches add column if not exists email_status text not null default 'Pendiente integración';
alter table public.dispatches add column if not exists email_sent_at timestamptz;
alter table public.dispatches add column if not exists storage_status text not null default 'Pendiente integración';
alter table public.dispatches add column if not exists updated_at timestamptz not null default now();
create unique index if not exists dispatches_internal_number_uq on public.dispatches(internal_number) where internal_number is not null;
create index if not exists dispatches_contract_idx on public.dispatches(contract_id);
create index if not exists dispatches_created_by_idx on public.dispatches(created_by);
create index if not exists dispatches_delivered_by_idx on public.dispatches(delivered_by);
create unique index if not exists inventory_dispatch_once_uq on public.inventory_movements(dispatch_line_id,movement_type) where dispatch_line_id is not null and movement_type in ('dispatch','adjustment');

create or replace function public.create_dispatch_v1(p_installation_id uuid,p_lines jsonb,p_observations text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_role text;v_id uuid;v_contract uuid;v_line jsonb;v_material uuid;v_qty numeric;v_available numeric;v_number text;v_actor text;
begin
 if v_user is null then raise exception 'Sesión no válida'; end if;
 select role,coalesce(full_name,email) into v_role,v_actor from public.user_profiles where id=v_user and active=true;
 if v_role is null or v_role not in ('Admin Total','Admin','Bodega') then raise exception 'No autorizado para crear despachos'; end if;
 select contract_id into v_contract from public.installations where id=p_installation_id and active=true;
 if v_contract is null then raise exception 'Instalación no válida'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Agrega al menos un material'; end if;
 v_number:='GI-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||lpad(nextval('public.dispatch_internal_number_seq')::text,6,'0');
 insert into public.dispatches(installation_id,contract_id,guide_number,internal_number,status,observations,recipient_name,recipient_email,recipient_phone,created_by)
 select i.id,i.contract_id,v_number,v_number,'Borrador',nullif(btrim(p_observations),''),i.delivery_contact_name,coalesce(i.delivery_email,i.general_email),coalesce(i.delivery_phone,i.phone),v_user from public.installations i where i.id=p_installation_id returning id into v_id;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  v_material:=(v_line->>'material_id')::uuid;v_qty:=(v_line->>'quantity')::numeric;
  if v_qty<=0 then raise exception 'Las cantidades deben ser mayores que cero'; end if;
  perform pg_advisory_xact_lock(hashtext(v_material::text));
  select coalesce(sum(signed_quantity),0) into v_available from public.inventory_movements where material_id=v_material;
  if v_qty>v_available then raise exception 'Cantidad superior a disponibilidad para material %',v_material; end if;
  insert into public.dispatch_lines(dispatch_id,material_id,required_qty,delivered_qty,pending_qty) values(v_id,v_material,v_qty,0,v_qty);
 end loop;
 insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data) values(v_user,v_actor,'Despachos','Creó despacho','dispatches',v_id,jsonb_build_object('internal_number',v_number,'installation_id',p_installation_id));
 return v_id;
end$$;

create or replace function public.transition_dispatch_v1(p_dispatch_id uuid,p_status text,p_reason text default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_role text;v_actor text;v_old text;v_installation uuid;v_line record;v_available numeric;v_action text;
begin
 select role,coalesce(full_name,email) into v_role,v_actor from public.user_profiles where id=v_user and active=true;
 if v_role is null or v_role not in ('Admin Total','Admin','Bodega') then raise exception 'No autorizado para gestionar salidas'; end if;
 select status,installation_id into v_old,v_installation from public.dispatches where id=p_dispatch_id for update;
 if v_old is null then raise exception 'Despacho no encontrado'; end if;
 if p_status='En preparación' and v_old<>'Borrador' then raise exception 'Transición de estado no válida';
 elsif p_status='Listo para despacho' and v_old<>'En preparación' then raise exception 'Transición de estado no válida';
 elsif p_status='En tránsito' and v_old<>'Listo para despacho' then raise exception 'Transición de estado no válida';
 elsif p_status in ('Rechazado/No entregado') and v_old not in ('En tránsito','Listo para despacho') then raise exception 'Transición de estado no válida';
 elsif p_status='Anulado' and v_old in ('Entregado conforme','Entrega con observaciones') then raise exception 'Una entrega cerrada no se puede anular';
 elsif p_status not in ('En preparación','Listo para despacho','En tránsito','Rechazado/No entregado','Anulado') then raise exception 'Estado no permitido'; end if;
 if p_status='En tránsito' then
  for v_line in select dl.id,dl.material_id,dl.required_qty from public.dispatch_lines dl where dl.dispatch_id=p_dispatch_id loop
   perform pg_advisory_xact_lock(hashtext(v_line.material_id::text));
   select coalesce(sum(signed_quantity),0) into v_available from public.inventory_movements where material_id=v_line.material_id;
   if v_line.required_qty>v_available then raise exception 'Disponibilidad insuficiente al confirmar salida'; end if;
   insert into public.inventory_movements(material_id,dispatch_line_id,movement_type,quantity,signed_quantity,created_by,observation) values(v_line.material_id,v_line.id,'dispatch',v_line.required_qty,-v_line.required_qty,v_user,'Salida física '||p_dispatch_id) on conflict do nothing;
  end loop;
 end if;
 if p_status='Anulado' and exists(select 1 from public.inventory_movements im join public.dispatch_lines dl on dl.id=im.dispatch_line_id where dl.dispatch_id=p_dispatch_id and im.movement_type='dispatch') then
  for v_line in select dl.id,dl.material_id,dl.required_qty from public.dispatch_lines dl where dl.dispatch_id=p_dispatch_id loop
   insert into public.inventory_movements(material_id,dispatch_line_id,movement_type,quantity,signed_quantity,created_by,observation) values(v_line.material_id,v_line.id,'adjustment',v_line.required_qty,v_line.required_qty,v_user,'Reversa por anulación '||p_dispatch_id) on conflict do nothing;
  end loop;
 end if;
 update public.dispatches set status=p_status,prepared_at=case when p_status='En preparación' then now() else prepared_at end,ready_at=case when p_status='Listo para despacho' then now() else ready_at end,in_transit_at=case when p_status='En tránsito' then now() else in_transit_at end,dispatched_at=case when p_status='En tránsito' then now() else dispatched_at end,cancelled_at=case when p_status='Anulado' then now() else cancelled_at end,cancellation_reason=case when p_status in ('Anulado','Rechazado/No entregado') then nullif(btrim(p_reason),'') else cancellation_reason end,updated_at=now() where id=p_dispatch_id;
 v_action:=case p_status when 'En preparación' then 'Preparó despacho' when 'Listo para despacho' then 'Dejó listo para despacho' when 'En tránsito' then 'Confirmó salida' when 'Anulado' then 'Anuló despacho' else 'Registró despacho no entregado' end;
 insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,old_data,new_data,observation) values(v_user,v_actor,'Despachos',v_action,'dispatches',p_dispatch_id,jsonb_build_object('status',v_old),jsonb_build_object('status',p_status),p_reason);
 return p_status;
end$$;

create or replace function public.register_dispatch_delivery_v1(p_dispatch_id uuid,p_lines jsonb,p_recipient_name text,p_recipient_rut text,p_recipient_role text,p_observations text,p_signature text)
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_role text;v_actor text;v_installation uuid;v_status text;v_line jsonb;v_id uuid;v_required numeric;v_delivered numeric;v_total_pending numeric;v_final text;
begin
 select role,coalesce(full_name,email) into v_role,v_actor from public.user_profiles where id=v_user and active=true;
 select installation_id,status into v_installation,v_status from public.dispatches where id=p_dispatch_id for update;
 if v_role is null or not(v_role in ('Admin Total','Admin','Bodega') or (v_role='Supervisora' and public.has_installation_access(v_installation))) then raise exception 'No autorizado para registrar esta entrega'; end if;
 if v_status<>'En tránsito' and v_status<>'Entrega parcial' then raise exception 'El despacho no está disponible para entrega'; end if;
 if nullif(btrim(p_recipient_name),'') is null or nullif(btrim(p_recipient_rut),'') is null then raise exception 'Nombre y RUT del receptor son obligatorios'; end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  v_id:=(v_line->>'line_id')::uuid;v_delivered:=(v_line->>'delivered_qty')::numeric;
  select required_qty into v_required from public.dispatch_lines where id=v_id and dispatch_id=p_dispatch_id;
  if v_required is null or v_delivered<0 or v_delivered>v_required then raise exception 'Cantidad entregada no válida'; end if;
  update public.dispatch_lines set delivered_qty=v_delivered,pending_qty=v_required-v_delivered where id=v_id;
 end loop;
 select coalesce(sum(pending_qty),0) into v_total_pending from public.dispatch_lines where dispatch_id=p_dispatch_id;
 v_final:=case when v_total_pending>0 then 'Entrega parcial' when nullif(btrim(p_observations),'') is not null then 'Entrega con observaciones' else 'Entregado conforme' end;
 update public.dispatches set status=v_final,recipient_name=btrim(p_recipient_name),recipient_rut=btrim(p_recipient_rut),recipient_role=nullif(btrim(p_recipient_role),''),observations=nullif(btrim(p_observations),''),recipient_signature=nullif(p_signature,''),delivered_by=v_user,delivered_at=now(),updated_at=now() where id=p_dispatch_id;
 insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data,observation) values(v_user,v_actor,'Despachos',case when v_final='Entrega parcial' then 'Registró entrega parcial' else 'Registró entrega' end,'dispatches',p_dispatch_id,jsonb_build_object('status',v_final,'recipient_name',p_recipient_name,'recipient_rut',p_recipient_rut,'signed',nullif(p_signature,'') is not null),p_observations);
 if nullif(p_signature,'') is not null then insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data) values(v_user,v_actor,'Despachos','Firmó/identificó receptor','dispatches',p_dispatch_id,jsonb_build_object('recipient_name',p_recipient_name,'recipient_rut',p_recipient_rut)); end if;
 return v_final;
end$$;

revoke all on function public.create_dispatch_v1(uuid,jsonb,text) from public,anon;
revoke all on function public.transition_dispatch_v1(uuid,text,text) from public,anon;
revoke all on function public.register_dispatch_delivery_v1(uuid,jsonb,text,text,text,text,text) from public,anon;
grant execute on function public.create_dispatch_v1(uuid,jsonb,text) to authenticated;
grant execute on function public.transition_dispatch_v1(uuid,text,text) to authenticated;
grant execute on function public.register_dispatch_delivery_v1(uuid,jsonb,text,text,text,text,text) to authenticated;

drop policy if exists dispatch_lines_read_assigned on public.dispatch_lines;
create policy dispatch_lines_read_assigned on public.dispatch_lines for select to authenticated using(exists(select 1 from public.dispatches d where d.id=dispatch_id and public.has_installation_access(d.installation_id)));
