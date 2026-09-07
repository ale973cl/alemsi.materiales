create or replace function public.register_purchase_order_receipt_v1(p_purchase_order_id uuid, p_lines jsonb, p_observation text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text; v_receipt uuid; v_status text; v_line jsonb; v_pol record; v_qty numeric; v_receipt_line uuid; v_price numeric; v_all_received boolean;
begin
 select role into v_role from user_profiles where id=v_user and active=true;
 if v_role is null or v_role not in ('Admin Total','Admin','Bodega') then raise exception 'No autorizado para registrar recepción'; end if;
 if not exists(select 1 from purchase_orders where id=p_purchase_order_id) then raise exception 'OC no encontrada'; end if;
 if jsonb_array_length(coalesce(p_lines,'[]'::jsonb))=0 then raise exception 'La recepción no contiene materiales'; end if;
 insert into receipts(purchase_order_id,status,received_by,received_at,invoice_net,vat_amount) values(p_purchase_order_id,'Pendiente',v_user,now(),0,0) returning id into v_receipt;
 for v_line in select * from jsonb_array_elements(p_lines) loop
  v_qty:=coalesce((v_line->>'received_qty')::numeric,0); if v_qty<=0 then continue; end if;
  select pol.*,coalesce((select sum(rl.received_qty) from receipt_lines rl join receipts r on r.id=rl.receipt_id where rl.purchase_order_line_id=pol.id),0) already_received into v_pol from purchase_order_lines pol where pol.id=(v_line->>'purchase_order_line_id')::uuid and pol.purchase_order_id=p_purchase_order_id;
  if not found then raise exception 'Línea de OC no válida'; end if;
  if v_pol.material_id is null then raise exception 'La línea % no corresponde a un material inventariable',v_pol.id; end if;
  if v_pol.already_received+v_qty>v_pol.ordered_qty then raise exception 'Recepción supera cantidad pendiente para %',coalesce(v_pol.description,v_pol.id::text); end if;
  v_price:=coalesce(nullif((v_line->>'actual_unit_net')::numeric,0),v_pol.unit_net_price,0);
  insert into receipt_lines(receipt_id,purchase_order_line_id,material_id,received_qty,actual_unit_net,line_net,difference_note) values(v_receipt,v_pol.id,v_pol.material_id,v_qty,v_price,v_qty*v_price,nullif(p_observation,'')) returning id into v_receipt_line;
  insert into inventory_movements(material_id,receipt_line_id,movement_type,quantity,signed_quantity,created_by,observation) values(v_pol.material_id,v_receipt_line,'receipt',v_qty,v_qty,v_user,coalesce(nullif(p_observation,''),'Recepción física desde OC'));
  if v_price>0 then update materials set current_net_price=v_price,price_source_note='Última recepción OC '||p_purchase_order_id::text where id=v_pol.material_id; end if;
 end loop;
 if not exists(select 1 from receipt_lines where receipt_id=v_receipt) then delete from receipts where id=v_receipt; raise exception 'Debes ingresar al menos una cantidad recibida mayor a cero'; end if;
 select not exists(select 1 from purchase_order_lines pol where pol.purchase_order_id=p_purchase_order_id and pol.material_id is not null and coalesce((select sum(rl.received_qty) from receipt_lines rl join receipts r on r.id=rl.receipt_id where rl.purchase_order_line_id=pol.id),0)<pol.ordered_qty) into v_all_received;
 v_status:=case when v_all_received then 'Recibida' else 'Parcial' end;
 update receipts set status=v_status where id=v_receipt;
 update purchase_orders set status=case when v_all_received then 'Recibida' else 'Recepción parcial' end where id=p_purchase_order_id;
 insert into activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data,observation) select v_user,coalesce(full_name,email),'Recepción','Registrar recepción física','receipts',v_receipt,jsonb_build_object('purchase_order_id',p_purchase_order_id,'status',v_status),p_observation from user_profiles where id=v_user;
 return v_receipt;
end $$;
grant execute on function public.register_purchase_order_receipt_v1(uuid,jsonb,text) to authenticated;

create or replace function public.create_dispatch_from_campaign_v1(p_campaign_id uuid,p_installation_id uuid,p_observations text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text; v_dispatch uuid; v_survey uuid; v_line record; v_available numeric; v_qty numeric; v_lines jsonb:='[]'::jsonb;
begin
 select role into v_role from user_profiles where id=v_user and active=true;
 if v_role is null or v_role not in ('Admin Total','Admin','Bodega') then raise exception 'No autorizado para preparar despacho'; end if;
 select s.id into v_survey from surveys s where s.campaign_id=p_campaign_id and s.installation_id=p_installation_id and s.status='Confirmada' order by s.confirmed_at desc limit 1;
 if v_survey is null then raise exception 'La instalación no tiene levantamiento confirmado en esta campaña'; end if;
 for v_line in select sl.material_id,sl.shortage_qty from survey_lines sl where sl.survey_id=v_survey and sl.shortage_qty>0 loop
  select coalesce(sum(im.signed_quantity),0) into v_available from inventory_movements im where im.material_id=v_line.material_id;
  select greatest(v_line.shortage_qty-coalesce((select sum(dl.required_qty) from dispatch_lines dl join dispatches d on d.id=dl.dispatch_id where d.installation_id=p_installation_id and dl.material_id=v_line.material_id and d.status<>'Anulado' and (d.observations like '%CAMPAÑA:'||p_campaign_id::text||'%' or d.observations like '%Campaña:'||p_campaign_id::text||'%')),0),0) into v_qty;
  v_qty:=least(v_qty,greatest(v_available,0)); if v_qty>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('material_id',v_line.material_id,'quantity',v_qty)); end if;
 end loop;
 if jsonb_array_length(v_lines)=0 then raise exception 'No hay cantidades pendientes con stock disponible para preparar'; end if;
 select create_dispatch_v1(p_installation_id,v_lines,concat('CAMPAÑA:',p_campaign_id::text,case when nullif(p_observations,'') is not null then ' · '||p_observations else '' end)) into v_dispatch;
 return v_dispatch;
end $$;
grant execute on function public.create_dispatch_from_campaign_v1(uuid,uuid,text) to authenticated;