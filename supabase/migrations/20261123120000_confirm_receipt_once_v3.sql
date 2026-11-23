-- ALEMSI: single confirmation after physical verification; invoice quantities govern stock.
-- Prerequisite: 20261118011206_receipt_integrity_v2.sql on an isolated test database.
-- DO NOT apply to shared Production. Keeps legacy functions for old receipts.
begin;
create or replace function public.register_receipt_v2(p_document jsonb,p_lines jsonb) returns uuid
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
 if nullif(btrim(coalesce(p_document->>'supplier_rut','')),'') is not null and
  upper(regexp_replace(p_document->>'supplier_rut','[^0-9kK]','','g'))<>v_rut then
  raise exception 'El RUT del emisor de la factura no corresponde al proveedor de la OC'; end if;
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
  coalesce(l->>'purchase_order_line_id',l->>'material_id') having count(*)>1) then raise exception 'Líneas duplicadas'; end if;
 for v_line in select * from jsonb_array_elements(p_lines) loop
  v_qty:=(v_line->>'received_qty')::numeric; v_price:=(v_line->>'actual_unit_net')::numeric;
  if v_qty is null or v_price is null or v_qty<=0 or v_price<0 or v_qty::text in ('NaN','Infinity','-Infinity') or v_price::text in ('NaN','Infinity','-Infinity') then raise exception 'Cantidad o precio inválido'; end if;
  if not exists(select 1 from public.materials where id=(v_line->>'material_id')::uuid and active) then raise exception 'Material inactivo o inexistente'; end if;
  if v_po is not null then
   if nullif(v_line->>'purchase_order_line_id','') is not null then
    select * into v_pol from public.purchase_order_lines where id=(v_line->>'purchase_order_line_id')::uuid and purchase_order_id=v_po;
    if not found or v_pol.material_id is distinct from (v_line->>'material_id')::uuid then raise exception 'Material ajeno a OC'; end if;
   elsif length(btrim(coalesce(v_line->>'difference_note','')))<8 then
    raise exception 'Producto adicional requiere identificación y explicación';
   end if;
  end if;
  v_sum:=v_sum+v_qty*v_price;
 end loop;
 if abs(v_sum-v_net)>1 then raise exception 'Neto de líneas no coincide con factura'; end if;
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

create or replace function public.reconcile_receipt_v2(p_receipt_id uuid) returns jsonb
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
    where rl.receipt_id=r.id and rl.purchase_order_line_id is not null and (pol.id is null or pol.purchase_order_id<>po.id or pol.material_id is distinct from rl.material_id)) then raise exception 'Material o cantidad ajena a OC'; end if;
  if exists(select 1 from public.receipt_lines where receipt_id=r.id and purchase_order_line_id is null) then v_diff:=true; end if;
  select v_diff or exists(select 1 from public.purchase_order_lines pol left join public.receipt_lines rl on rl.purchase_order_line_id=pol.id and rl.receipt_id=r.id
   where pol.purchase_order_id=po.id and (rl.id is null or rl.received_qty<>pol.ordered_qty or rl.actual_unit_net<>pol.unit_net_price)) or po.total_net<>r.document_net into v_diff;
  select coalesce(sum(greatest(pol.ordered_qty-coalesce(rl.received_qty,0),0)),0) into v_outstanding
   from public.purchase_order_lines pol left join public.receipt_lines rl on rl.purchase_order_line_id=pol.id and rl.receipt_id=r.id where pol.purchase_order_id=po.id;
 elsif length(btrim(coalesce(r.no_oc_reason,'')))<8 then raise exception 'Justificación sin OC obligatoria'; end if;
 if exists(select 1 from public.receipt_lines where receipt_id=r.id and
  (received_qty<=0 or actual_unit_net<0 or received_qty::text in ('NaN','Infinity','-Infinity') or actual_unit_net::text in ('NaN','Infinity','-Infinity') or abs(line_net-received_qty*actual_unit_net)>1)) then raise exception 'Líneas inválidas'; end if;
 if abs(r.document_net+r.vat_amount-r.document_total)>1 then raise exception 'Totales no coinciden'; end if;
 if abs((select sum(received_qty*actual_unit_net) from public.receipt_lines where receipt_id=r.id)-r.document_net)>1 then
  raise exception 'Neto de líneas no coincide con factura';
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

create function public.confirm_receipt_once_v3(p_document jsonb,p_lines jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_role text; v_id uuid; v_result jsonb;
begin
 select role into v_role from public.user_profiles where id=v_user and active;
 if v_user is null or v_role is distinct from 'Admin Total' then
  raise exception 'Confirmación única habilitada exclusivamente para Admin Total en el piloto aislado';
 end if;
 -- Both operations execute in the same transaction. Any failure rolls back receipt, movements, prices and PO state.
 if p_document ? 'pending_resolution' and jsonb_typeof(p_document->'pending_resolution')<>'array' then
  raise exception 'Decisiones de saldo inválidas';
 end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_document->'pending_resolution','[]'::jsonb)) x
  where coalesce(x->>'decision','') not in ('acumular','mismo','otro')
     or coalesce(x->>'purchase_order_line_id','') !~ '^[0-9a-fA-F-]{36}$') then
  raise exception 'El destino de los faltantes es inválido';
 end if;
 v_id:=public.register_receipt_v2(p_document,p_lines);
 v_result:=public.reconcile_receipt_v2(v_id);
 if not coalesce((v_result->>'alreadyPosted')::boolean,false) and
    jsonb_array_length(coalesce(p_document->'pending_resolution','[]'::jsonb))>0 then
   if exists(select 1 from jsonb_array_elements(p_document->'pending_resolution') x
    where not exists(select 1 from public.purchase_order_lines pol
      join public.receipts r on pol.purchase_order_id=r.purchase_order_id
      where r.id=v_id and pol.id=(x->>'purchase_order_line_id')::uuid)) then
    raise exception 'Saldo ajeno a la OC';
   end if;
   insert into public.activity_log(actor_id,actor_name,module,action,entity_table,entity_id,new_data)
   select v_user,coalesce(full_name,email),'Recepción','Destino de faltantes de factura','receipts',v_id,
     jsonb_build_object('pending_resolution',p_document->'pending_resolution')
   from public.user_profiles where id=v_user;
 end if;
 return v_result||jsonb_build_object('id',v_id);
end $$;
revoke all on function public.confirm_receipt_once_v3(jsonb,jsonb) from public,anon;
grant execute on function public.confirm_receipt_once_v3(jsonb,jsonb) to authenticated;
commit;
