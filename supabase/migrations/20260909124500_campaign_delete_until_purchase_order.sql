create or replace function public.delete_campaign_admin(p_campaign_id uuid, p_confirmation text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_actor_name text;
  v_campaign jsonb;
  v_po_count integer;
  v_dispatch_count integer;
  v_local_count integer;
begin
  if p_confirmation <> 'ELIMINAR' then
    raise exception 'Confirmación de eliminación inválida';
  end if;

  select role, coalesce(full_name,email,'Usuario') into v_role, v_actor_name
  from public.user_profiles where id=auth.uid() and active=true;

  if v_role is null or v_role not in ('Admin Total','Gerencia') then
    raise exception 'No autorizado para eliminar campañas';
  end if;

  select to_jsonb(c) into v_campaign from public.campaigns c where c.id=p_campaign_id;
  if v_campaign is null then
    raise exception 'Campaña no encontrada';
  end if;

  select count(*) into v_po_count
  from public.purchase_orders po
  join public.supply_runs sr on sr.id=po.supply_run_id
  where sr.campaign_id=p_campaign_id;

  if v_po_count>0 then
    raise exception 'La campaña ya tiene una orden de compra generada. Debes cerrarla, no eliminarla';
  end if;

  select count(*) into v_dispatch_count from public.dispatches where campaign_id=p_campaign_id;
  if v_dispatch_count>0 then
    raise exception 'La campaña ya tiene despachos relacionados. Debes cerrarla, no eliminarla';
  end if;

  select count(*) into v_local_count
  from public.local_purchase_requests lpr
  join public.surveys s on s.id=lpr.survey_id
  where s.campaign_id=p_campaign_id;
  if v_local_count>0 then
    raise exception 'La campaña tiene compras locales relacionadas. Debes cerrarla, no eliminarla';
  end if;

  insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,old_data,observation)
  values(auth.uid(),v_actor_name,'Campañas','Eliminar campaña','campaigns',p_campaign_id,v_campaign,'Eliminación administrativa autorizada antes de generar OC');

  delete from public.supply_allocations
  where supply_line_id in (
    select sl.id from public.supply_lines sl
    join public.supply_runs sr on sr.id=sl.supply_run_id
    where sr.campaign_id=p_campaign_id
  );

  delete from public.supply_lines
  where supply_run_id in (select id from public.supply_runs where campaign_id=p_campaign_id);

  delete from public.supply_runs where campaign_id=p_campaign_id;

  delete from public.survey_lines
  where survey_id in (select id from public.surveys where campaign_id=p_campaign_id);

  delete from public.surveys where campaign_id=p_campaign_id;
  delete from public.campaign_installations where campaign_id=p_campaign_id;
  delete from public.campaigns where id=p_campaign_id;
end;
$function$;
