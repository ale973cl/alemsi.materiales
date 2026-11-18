-- Apply only to an authorized test destination. Existing duplicates stop this migration.
begin;
alter table public.receipts add column issuer_rut text;
alter table public.receipts add column registration_payload jsonb;
update public.receipts r set issuer_rut=upper(regexp_replace(s.rut,'[^0-9kK]','','g'))
from public.suppliers s where s.id=r.supplier_id;
create unique index receipts_issuer_document_unique on public.receipts
(issuer_rut,document_type,upper(btrim(document_folio)))
where issuer_rut is not null and document_type is not null and nullif(btrim(document_folio),'') is not null;
create unique index inventory_receipt_line_unique on public.inventory_movements(receipt_line_id)
where receipt_line_id is not null and movement_type='receipt';
create unique index receipts_one_document_per_order_v2 on public.receipts(purchase_order_id) where purchase_order_id is not null;

create function public.receipt_identity_v2() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.inventory_posted then raise exception 'No se puede eliminar un documento confirmado'; end if;
  return old;
 end if;
 if tg_op='INSERT' or new.supplier_id is distinct from old.supplier_id then
  select upper(regexp_replace(s.rut,'[^0-9kK]','','g')) into new.issuer_rut
  from public.suppliers s where s.id=new.supplier_id;
  if new.issuer_rut is null or new.issuer_rut !~ '^[0-9]{7,8}[0-9K]$' then
   raise exception 'Proveedor sin RUT válido';
  end if;
 elsif new.issuer_rut is distinct from old.issuer_rut then
  raise exception 'No se puede alterar el RUT histórico del documento';
 end if;
 if tg_op='UPDATE' and old.inventory_posted then
  if new is distinct from old then raise exception 'Documento ya incorporado al inventario; requiere regularización'; end if;
 end if;
 if tg_op='UPDATE' and (new.supplier_id,new.document_type,new.document_folio,new.document_date,new.document_net,new.vat_amount,new.document_total,new.purchase_order_id,new.no_oc_reason)
  is distinct from (old.supplier_id,old.document_type,old.document_folio,old.document_date,old.document_net,old.vat_amount,old.document_total,old.purchase_order_id,old.no_oc_reason) then
  new.registration_payload:=null; -- edited draft must never be accepted as an identical retry
 end if;
 if new.inventory_posted and (tg_op='INSERT' or not old.inventory_posted) and
  coalesce(public.current_app_role(),'') not in ('Admin Total','Gerencia','Finanzas') then raise exception 'Solo Finanzas o Gerencia confirma inventario'; end if;
 return new;
end $$;
create trigger receipt_identity_v2 before insert or update or delete on public.receipts
for each row execute function public.receipt_identity_v2();

create function public.register_receipt_v2(p_document jsonb,p_lines jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_role text; v_id uuid; v_po uuid:=nullif(p_document->>'purchase_order_id','')::uuid;
 v_supplier uuid:=nullif(p_document->>'supplier_id','')::uuid; v_line jsonb; v_pol record;
 v_net numeric:=(p_document->>'document_net')::numeric; v_vat numeric:=(p_document->>'vat_amount')::numeric;
 v_total numeric:=(p_document->>'document_total')::numeric; v_sum numeric:=0; v_qty numeric; v_price numeric;
 v_rut text; v_existing public.receipts%rowtype; v_payload jsonb;
 v_shipping text:=coalesce(p_document->>'shipping_condition','Incluido');
 v_freight numeric:=coalesce((p_document->>'freight_net')::numeric,0);
begin
 select role into v_role from public.user_profiles where id=v_user and active;
 if v_user is null or v_role is null or v_role not in ('Admin Total','Admin','Bodega','Finanzas','Gerencia') then raise exception 'No autorizado'; end if;
 if v_po is not null and v_role not in ('Admin Total','Admin','Bodega') then raise exception 'No autorizado para recepción contra OC'; end if;
 if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Detalle inválido'; end if;
 if jsonb_array_length(p_lines) not between 1 and 500 then raise exception 'Detalle vacío o excesivo'; end if;
 if v_net is null or v_vat is null or v_total is null or least(v_net,v_vat,v_total)<0 or
    v_net::text in ('NaN','Infinity','-Infinity') or v_vat::text in ('NaN','Infinity','-Infinity') or
    v_total::text in ('NaN','Infinity','-Infinity') or abs(v_net+v_vat-v_total)>1 then raise exception 'Importes inválidos'; end if;
 if coalesce(p_document->>'document_type','') not in ('Factura','Boleta','Guía de despacho','Otro') or
    nullif(btrim(p_document->>'document_folio'),'') is null or length(btrim(p_document->>'document_folio'))>100 or
    coalesce(p_document->>'document_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Documento incompleto'; end if;
 if v_shipping not in ('Incluido','Por pagar','Retiro') or v_freight<0 or v_freight::text in ('NaN','Infinity','-Infinity') or
  (v_shipping='Por pagar' and v_freight<=0) then raise exception 'Flete inválido'; end if;
 if v_po is not null then select supplier_id into v_supplier from public.purchase_orders where id=v_po; end if;
 select upper(regexp_replace(rut,'[^0-9kK]','','g')) into v_rut from public.suppliers where id=v_supplier and active;
 if v_rut is null then raise exception 'Proveedor inactivo o inexistente'; end if;
 v_payload:=jsonb_build_object('document',p_document,'lines',p_lines);
 perform pg_advisory_xact_lock(hashtextextended(v_rut||':'||(p_document->>'document_type')||':'||upper(btrim(p_document->>'document_folio')),0));
 select * into v_existing from public.receipts where issuer_rut=v_rut and document_type=p_document->>'document_type' and upper(btrim(document_folio))=upper(btrim(p_document->>'document_folio'));
 if found then
  if v_existing.registration_payload=v_payload then return v_existing.id; end if;
  raise exception 'Documento ya registrado con contenido diferente';
 end if;
 if v_po is not null then
  -- Bodega may read an OC, but cannot UPDATE it; an advisory lock preserves RLS.
  perform pg_advisory_xact_lock(hashtextextended(v_po::text,0));
  select supplier_id into v_supplier from public.purchase_orders where id=v_po and status not in
   ('Cerrada','Cerrada incompleta','Anulada','Cancelada','Finalizada','Recepcionada');
  if not found then raise exception 'OC cerrada o inexistente'; end if;
  if exists(select 1 from public.receipts where purchase_order_id=v_po) then raise exception 'La OC ya tiene documento'; end if;
 elsif length(btrim(coalesce(p_document->>'no_oc_reason','')))<8 then raise exception 'Justificación sin OC obligatoria'; end if;
 if not exists(select 1 from public.suppliers where id=v_supplier and active) then raise exception 'Proveedor inactivo o inexistente'; end if;
 if exists(select 1 from jsonb_array_elements(p_lines) l group by
  case when v_po is null then l->>'material_id' else l->>'purchase_order_line_id' end having count(*)>1) then raise exception 'Líneas duplicadas'; end if;
 for v_line in select * from jsonb_array_elements(p_lines) loop
  v_qty:=(v_line->>'received_qty')::numeric; v_price:=(v_line->>'actual_unit_net')::numeric;
  if v_qty is null or v_price is null or v_qty<=0 or v_price<0 or v_qty::text in ('NaN','Infinity','-Infinity') or v_price::text in ('NaN','Infinity','-Infinity') then raise exception 'Cantidad o precio inválido'; end if;
  if not exists(select 1 from public.materials where id=(v_line->>'material_id')::uuid and active) then raise exception 'Material inactivo o inexistente'; end if;
  if v_po is not null then
   select * into v_pol from public.purchase_order_lines where id=(v_line->>'purchase_order_line_id')::uuid and purchase_order_id=v_po;
   if not found or v_pol.material_id is distinct from (v_line->>'material_id')::uuid or v_qty>v_pol.ordered_qty then raise exception 'Cantidad o material ajeno a OC'; end if;
  end if;
  v_sum:=v_sum+v_qty*v_price;
 end loop;
 if v_po is null and abs(v_sum-v_net)>1 then raise exception 'Neto de líneas no coincide'; end if;
 insert into public.receipts(registration_payload,purchase_order_id,supplier_id,document_type,document_folio,document_date,document_net,document_total,
 invoice_number,invoice_date,invoice_net,vat_amount,no_oc_reason,status,reconciliation_status,inventory_posted,received_by,received_at,shipping_condition,freight_net)
 values(null,v_po,v_supplier,p_document->>'document_type',btrim(p_document->>'document_folio'),(p_document->>'document_date')::date,v_net,v_total,
 case when p_document->>'document_type'='Factura' then btrim(p_document->>'document_folio') end,(p_document->>'document_date')::date,v_net,v_vat,
 p_document->>'no_oc_reason','Pendiente cotejo','Pendiente cotejo',false,v_user,now(),v_shipping,case when v_shipping='Por pagar' then v_freight else 0 end) returning id into v_id;
 insert into public.receipt_lines(receipt_id,purchase_order_line_id,material_id,received_qty,actual_unit_net,line_net)
 select v_id,case when v_po is not null then (l->>'purchase_order_line_id')::uuid end,(l->>'material_id')::uuid,
 (l->>'received_qty')::numeric,(l->>'actual_unit_net')::numeric,(l->>'received_qty')::numeric*(l->>'actual_unit_net')::numeric
 from jsonb_array_elements(p_lines) l;
 update public.receipts set registration_payload=v_payload where id=v_id;
 insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data)
 select v_user,coalesce(full_name,email),'Recepción','Registrar documento pendiente de cotejo','receipts',v_id,p_document
 from public.user_profiles where id=v_user;
 return v_id;
end $$;
-- Narrow additions: preserve RLS and require the actor and the exact receipt line.
create policy receipts_management_insert_v2 on public.receipts for insert to authenticated with check
 (public.current_app_role()='Gerencia' and received_by=auth.uid() and not inventory_posted and reconciliation_status='Pendiente cotejo');
create policy receipt_lines_management_insert_v2 on public.receipt_lines for insert to authenticated with check
 (public.current_app_role()='Gerencia' and exists(select 1 from public.receipts r where r.id=receipt_id and r.received_by=auth.uid() and not r.inventory_posted));
create policy receipts_management_reconcile_v2 on public.receipts for update to authenticated
 using (public.current_app_role()='Gerencia')
 with check (public.current_app_role()='Gerencia' and (
  (inventory_posted and reconciled_by=auth.uid() and reconciliation_status in ('Conforme','Con diferencia','Confirmada sin OC'))
  or (not inventory_posted and received_by=auth.uid() and reconciliation_status='Pendiente cotejo')));
create policy inventory_financial_receipt_v2 on public.inventory_movements for insert to authenticated with check
 (public.current_app_role() in ('Gerencia','Finanzas') and created_by=auth.uid() and movement_type='receipt'
 and exists(select 1 from public.receipt_lines l join public.receipts r on r.id=l.receipt_id
 where l.id=receipt_line_id and l.material_id=inventory_movements.material_id and l.received_qty=quantity
 and signed_quantity=quantity and quantity>0 and r.inventory_posted and r.reconciled_by=auth.uid()));

create function public.protect_receipt_lines_v2() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_posted boolean; v_parent uuid;
begin
 if tg_op='UPDATE' and new.receipt_id is distinct from old.receipt_id then raise exception 'No se puede trasladar una línea entre documentos'; end if;
 v_parent:=case when tg_op='DELETE' then old.receipt_id else new.receipt_id end;
 select inventory_posted into v_posted from public.receipts where id=v_parent for update;
 if not found or v_posted then raise exception 'Documento inexistente o inventario ya confirmado'; end if;
 update public.receipts set registration_payload=null where id=v_parent;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger protect_receipt_lines_v2 before insert or update or delete on public.receipt_lines
for each row execute function public.protect_receipt_lines_v2();

create function public.validate_inventory_receipt_v2() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.movement_type='receipt' and (new.receipt_line_id is null or not exists(
  select 1 from public.receipt_lines l join public.receipts r on r.id=l.receipt_id
  where l.id=new.receipt_line_id and r.inventory_posted and r.reconciled_by is not null
   and l.material_id=new.material_id and l.received_qty=new.quantity and new.signed_quantity=new.quantity and new.quantity>0
 )) then raise exception 'Inventario requiere cantidades declaradas y recepción validada'; end if;
 return new;
end $$;
create trigger validate_inventory_receipt_v2 before insert on public.inventory_movements
for each row execute function public.validate_inventory_receipt_v2();
revoke all on function public.validate_inventory_receipt_v2() from public,anon;

create function public.reconcile_receipt_v2(p_receipt_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_role text; r public.receipts%rowtype; l record; po public.purchase_orders%rowtype;
 v_diff boolean:=false; v_status text; v_order_status text; v_outstanding numeric:=0;
 v_stock numeric; v_old numeric; v_weighted numeric; v_count integer;
begin
 select role into v_role from public.user_profiles where id=v_user and active;
 if v_user is null or v_role is null or v_role not in ('Admin Total','Gerencia','Finanzas') then raise exception 'No autorizado para cotejar'; end if;
 select * into r from public.receipts where id=p_receipt_id for update;
 if not found then raise exception 'Documento no encontrado'; end if;
 if r.inventory_posted then
  select status into v_order_status from public.purchase_orders where id=r.purchase_order_id;
  return jsonb_build_object('ok',true,'status',r.reconciliation_status,'purchaseOrderId',r.purchase_order_id,'orderStatus',v_order_status,'alreadyPosted',true);
 end if;
 select count(*) into v_count from public.receipt_lines where receipt_id=r.id;
 if v_count=0 then raise exception 'Documento sin productos recibidos'; end if;
 if r.document_net<0 or r.vat_amount<0 or r.document_total<0 or r.document_net::text in ('NaN','Infinity','-Infinity') or
  r.vat_amount::text in ('NaN','Infinity','-Infinity') or r.document_total::text in ('NaN','Infinity','-Infinity') then raise exception 'Importes inválidos'; end if;
 if exists(select 1 from public.receipt_lines rl join public.inventory_movements im on im.receipt_line_id=rl.id where rl.receipt_id=r.id) then raise exception 'Movimientos previos: requiere regularización'; end if;
 if r.purchase_order_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(r.purchase_order_id::text,0));
  select * into po from public.purchase_orders where id=r.purchase_order_id for update;
  if not found or po.status in ('Anulada','Cancelada','Cerrada','Cerrada incompleta','Finalizada','Recepcionada') then raise exception 'OC cerrada o inexistente'; end if;
  if exists(select 1 from public.receipts other where other.purchase_order_id=po.id and other.id<>r.id) then raise exception 'OC con múltiples documentos: requiere revisión'; end if;
  if exists(select 1 from public.receipt_lines rl left join public.purchase_order_lines pol on pol.id=rl.purchase_order_line_id
    where rl.receipt_id=r.id and (pol.id is null or pol.purchase_order_id<>po.id or pol.material_id is distinct from rl.material_id or rl.received_qty>pol.ordered_qty)) then raise exception 'Material o cantidad ajena a OC'; end if;
  select exists(select 1 from public.purchase_order_lines pol left join public.receipt_lines rl on rl.purchase_order_line_id=pol.id and rl.receipt_id=r.id
   where pol.purchase_order_id=po.id and (rl.id is null or rl.received_qty<>pol.ordered_qty or rl.actual_unit_net<>pol.unit_net_price)) or po.total_net<>r.document_net into v_diff;
  select coalesce(sum(greatest(pol.ordered_qty-coalesce(rl.received_qty,0),0)),0) into v_outstanding
   from public.purchase_order_lines pol left join public.receipt_lines rl on rl.purchase_order_line_id=pol.id and rl.receipt_id=r.id where pol.purchase_order_id=po.id;
 elsif length(btrim(coalesce(r.no_oc_reason,'')))<8 then raise exception 'Justificación sin OC obligatoria'; end if;
 if exists(select 1 from public.receipt_lines where receipt_id=r.id and
  (received_qty<=0 or actual_unit_net<0 or received_qty::text in ('NaN','Infinity','-Infinity') or actual_unit_net::text in ('NaN','Infinity','-Infinity') or abs(line_net-received_qty*actual_unit_net)>1)) then raise exception 'Líneas inválidas'; end if;
 if abs(r.document_net+r.vat_amount-r.document_total)>1 then raise exception 'Totales no coinciden'; end if;
 if abs((select sum(received_qty*actual_unit_net) from public.receipt_lines where receipt_id=r.id)-r.document_net)>1 then
  if r.purchase_order_id is null then raise exception 'Neto de líneas no coincide'; end if;
  v_diff:=true;
 end if;
 -- Stable lock order serializes price updates between receipts of the same materials.
 perform m.id from public.materials m where m.id in (select material_id from public.receipt_lines where receipt_id=r.id) order by m.id for update;
 v_status:=case when r.purchase_order_id is null then 'Confirmada sin OC' when v_diff then 'Con diferencia' else 'Conforme' end;
 update public.receipts set inventory_posted=true,reconciliation_status=v_status,status=v_status,reconciled_by=v_user,reconciled_at=now() where id=r.id;
 if not found then raise exception 'No se pudo confirmar el documento'; end if;
 for l in select * from public.receipt_lines where receipt_id=r.id order by material_id,id loop
  select current_net_price into v_old from public.materials where id=l.material_id;
  if not found then raise exception 'Material no encontrado'; end if;
  select greatest(coalesce(sum(signed_quantity),0),0) into v_stock from public.inventory_movements where material_id=l.material_id;
  v_weighted:=(v_stock*v_old+l.received_qty*l.actual_unit_net)/(v_stock+l.received_qty);
  insert into public.inventory_movements(material_id,receipt_line_id,movement_type,quantity,signed_quantity,created_by,observation)
   values(l.material_id,l.id,'receipt',l.received_qty,l.received_qty,v_user,'Documento '||coalesce(r.document_folio,'sin folio'));
  update public.materials set current_net_price=round(v_weighted,4),price_review_required=false,
   price_source_note='Promedio ponderado actualizado con documento '||coalesce(r.document_folio,'validado'),updated_at=now() where id=l.material_id;
  if not found then raise exception 'No se pudo actualizar el precio del material'; end if;
 end loop;
 if r.purchase_order_id is not null then
  v_order_status:=case when v_outstanding>0 then 'Cerrada incompleta' else 'Cerrada' end;
  update public.purchase_orders set status=v_order_status where id=po.id;
  if not found then raise exception 'No se pudo cerrar la OC'; end if;
 end if;
 insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data)
 select v_user,coalesce(full_name,email),'Finanzas','Cotejar documento y cargar inventario','receipts',r.id,
  jsonb_build_object('status',v_status,'inventory_posted',true,'outstanding',v_outstanding) from public.user_profiles where id=v_user;
 return jsonb_build_object('ok',true,'status',v_status,'purchaseOrderId',r.purchase_order_id,'orderStatus',v_order_status,'outstanding',v_outstanding,'alreadyPosted',false);
end $$;
revoke all on function public.reconcile_receipt_v2(uuid) from public,anon;
grant execute on function public.reconcile_receipt_v2(uuid) to authenticated;
revoke all on function public.protect_receipt_lines_v2() from public,anon;
revoke all on function public.register_receipt_v2(jsonb,jsonb) from public,anon;
grant execute on function public.register_receipt_v2(jsonb,jsonb) to authenticated;
revoke all on function public.receipt_identity_v2() from public,anon;
commit;
