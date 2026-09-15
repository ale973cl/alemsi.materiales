-- Entregas parciales: conserva cada guia emitida y genera complementarias solo a solicitud.
alter table public.dispatches add column if not exists parent_dispatch_id uuid references public.dispatches(id);
create index if not exists dispatches_parent_dispatch_idx on public.dispatches(parent_dispatch_id);
create unique index if not exists dispatches_one_complement_uq on public.dispatches(parent_dispatch_id) where parent_dispatch_id is not null and status <> 'Anulado';

create or replace function public.register_dispatch_delivery_v1(p_dispatch_id uuid,p_lines jsonb,p_recipient_name text,p_recipient_rut text,p_recipient_role text,p_observations text,p_signature text)
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_role text;v_actor text;v_installation uuid;v_status text;v_existing_observations text;v_line jsonb;v_id uuid;v_required numeric;v_delivered numeric;v_total_pending numeric;v_final text;v_pending record;
begin
 select role,coalesce(full_name,email) into v_role,v_actor from public.user_profiles where id=v_user and active=true;
 select installation_id,status,observations into v_installation,v_status,v_existing_observations from public.dispatches where id=p_dispatch_id for update;
 if v_role is null or not(v_role in ('Admin Total','Admin','Bodega') or (v_role='Supervisora' and public.has_installation_access(v_installation))) then raise exception 'No autorizado para registrar esta entrega'; end if;
 if v_status<>'En tránsito' then raise exception 'La guía ya fue cerrada y no puede modificarse'; end if;
 if nullif(btrim(p_recipient_name),'') is null or nullif(btrim(p_recipient_rut),'') is null then raise exception 'Nombre y RUT del receptor son obligatorios'; end if;
 if jsonb_array_length(coalesce(p_lines,'[]'::jsonb))<>(select count(*) from public.dispatch_lines where dispatch_id=p_dispatch_id) then raise exception 'Debes registrar todas las líneas de la guía'; end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  v_id:=(v_line->>'line_id')::uuid;v_delivered:=(v_line->>'delivered_qty')::numeric;
  select required_qty into v_required from public.dispatch_lines where id=v_id and dispatch_id=p_dispatch_id;
  if v_required is null or v_delivered<0 or v_delivered>v_required then raise exception 'Cantidad entregada no válida'; end if;
  update public.dispatch_lines set delivered_qty=v_delivered,pending_qty=v_required-v_delivered where id=v_id;
 end loop;
 select coalesce(sum(pending_qty),0) into v_total_pending from public.dispatch_lines where dispatch_id=p_dispatch_id;
 v_final:=case when v_total_pending>0 then 'Entrega parcial' when nullif(btrim(p_observations),'') is not null then 'Entrega con observaciones' else 'Entregado conforme' end;
 if v_total_pending>0 then
  for v_pending in select id,material_id,pending_qty from public.dispatch_lines where dispatch_id=p_dispatch_id and pending_qty>0 loop
   insert into public.inventory_movements(material_id,dispatch_line_id,movement_type,quantity,signed_quantity,created_by,observation)
   values(v_pending.material_id,v_pending.id,'adjustment',v_pending.pending_qty,v_pending.pending_qty,v_user,'Saldo no entregado de guía parcial '||p_dispatch_id) on conflict do nothing;
  end loop;
 end if;
 update public.dispatches set status=v_final,recipient_name=btrim(p_recipient_name),recipient_rut=btrim(p_recipient_rut),recipient_role=nullif(btrim(p_recipient_role),''),observations=concat_ws(' · ',nullif(btrim(v_existing_observations),''),nullif(btrim(p_observations),'')),recipient_signature=nullif(p_signature,''),delivered_by=v_user,delivered_at=now(),updated_at=now() where id=p_dispatch_id;
 insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data,observation) values(v_user,v_actor,'Despachos',case when v_final='Entrega parcial' then 'Registró entrega parcial' else 'Registró entrega' end,'dispatches',p_dispatch_id,jsonb_build_object('status',v_final,'recipient_name',p_recipient_name,'recipient_rut',p_recipient_rut,'pending_units',v_total_pending,'signed',nullif(p_signature,'') is not null),p_observations);
 if nullif(p_signature,'') is not null then insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data) values(v_user,v_actor,'Despachos','Firmó/identificó receptor','dispatches',p_dispatch_id,jsonb_build_object('recipient_name',p_recipient_name,'recipient_rut',p_recipient_rut)); end if;
 return v_final;
end$$;

create or replace function public.create_complementary_dispatch_v1(p_parent_dispatch_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_role text;v_actor text;v_parent record;v_lines jsonb;v_child uuid;v_campaign_text text;
begin
 select role,coalesce(full_name,email) into v_role,v_actor from public.user_profiles where id=v_user and active=true;
 if v_role is null or v_role not in ('Admin Total','Admin','Bodega') then raise exception 'No autorizado para generar guía complementaria'; end if;
 select id,installation_id,internal_number,guide_number,status,observations into v_parent from public.dispatches where id=p_parent_dispatch_id for update;
 if v_parent.id is null then raise exception 'Guía original no encontrada'; end if;
 if v_parent.status<>'Entrega parcial' then raise exception 'La guía no tiene una entrega parcial pendiente'; end if;
 if exists(select 1 from public.dispatches where parent_dispatch_id=p_parent_dispatch_id and status<>'Anulado') then raise exception 'Esta guía ya tiene una complementaria generada'; end if;
 select jsonb_agg(jsonb_build_object('material_id',material_id,'quantity',pending_qty) order by id) into v_lines from public.dispatch_lines where dispatch_id=p_parent_dispatch_id and pending_qty>0;
 if coalesce(jsonb_array_length(v_lines),0)=0 then raise exception 'La guía no tiene materiales pendientes'; end if;
 v_campaign_text:=regexp_replace(coalesce(v_parent.observations,''),'^CAMPAÑA:[^·]+·?\s*','');
 select public.create_dispatch_v1(v_parent.installation_id,v_lines,concat_ws(' · ',nullif(substring(coalesce(v_parent.observations,'') from 'CAMPAÑA:[0-9a-fA-F-]+'),''),'Entrega de materiales pendientes',nullif(v_campaign_text,''),'Complementa guía '||coalesce(v_parent.internal_number,v_parent.guide_number))) into v_child;
 update public.dispatches set parent_dispatch_id=p_parent_dispatch_id where id=v_child;
 insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data) values(v_user,v_actor,'Despachos','Generó guía complementaria','dispatches',v_child,jsonb_build_object('parent_dispatch_id',p_parent_dispatch_id,'parent_guide',coalesce(v_parent.internal_number,v_parent.guide_number)));
 return v_child;
end$$;

revoke all on function public.create_complementary_dispatch_v1(uuid) from public,anon;
grant execute on function public.create_complementary_dispatch_v1(uuid) to authenticated;
