-- Minimal test fixture from inspected column and RLS contracts; not a deployment baseline.
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create table user_profiles(id uuid primary key,role text,active boolean,full_name text,email text);
create function current_app_role() returns text language sql stable as $$ select role from public.user_profiles where id=auth.uid() and active $$;
create table suppliers(id uuid primary key,legal_name text,rut text,active boolean default true);
create table materials(id uuid primary key,current_net_price numeric default 0,active boolean default true,price_review_required boolean default false,price_source_note text,updated_at timestamptz);
create table purchase_orders(id uuid primary key,supplier_id uuid,status text,total_net numeric);
create table purchase_order_lines(id uuid primary key,purchase_order_id uuid,material_id uuid,ordered_qty numeric,unit_net_price numeric);
create table receipts(id uuid primary key default gen_random_uuid(),purchase_order_id uuid references purchase_orders,supplier_id uuid references suppliers,
 document_type text,document_folio text,document_date date,document_net numeric default 0,document_total numeric default 0,
 invoice_number text,invoice_date date,invoice_net numeric,vat_amount numeric,no_oc_reason text,status text,reconciliation_status text,
 inventory_posted boolean default false,received_by uuid,received_at timestamptz,shipping_condition text,freight_net numeric,reconciled_by uuid,reconciled_at timestamptz);
create table receipt_lines(id uuid primary key default gen_random_uuid(),receipt_id uuid references receipts,purchase_order_line_id uuid references purchase_order_lines,material_id uuid references materials,received_qty numeric,actual_unit_net numeric,line_net numeric,difference_note text);
create table inventory_movements(id uuid primary key default gen_random_uuid(),material_id uuid references materials,receipt_line_id uuid references receipt_lines,movement_type text,quantity numeric,signed_quantity numeric,created_by uuid,observation text);
create table activity_log(id uuid primary key default gen_random_uuid(),actor_id uuid,actor_name text,module text,action text,entity_table text,entity_id uuid,new_data jsonb);
grant usage on schema public,auth to authenticated;
grant select on all tables in schema public to authenticated;
grant insert,update,delete on receipts,receipt_lines,inventory_movements,materials,purchase_orders,activity_log to authenticated;
alter table receipts enable row level security;
alter table receipt_lines enable row level security;
alter table inventory_movements enable row level security;
alter table materials enable row level security;
alter table purchase_orders enable row level security;
alter table activity_log enable row level security;
create policy receipts_read_ops on receipts for select to authenticated using(current_app_role() in ('Admin Total','Admin','Gerencia','Finanzas','Bodega'));
create policy receipts_write_fin_bodega on receipts for all to authenticated using(current_app_role() in ('Admin Total','Admin','Finanzas','Bodega')) with check(current_app_role() in ('Admin Total','Admin','Finanzas','Bodega'));
create policy receipt_lines_read_ops on receipt_lines for select to authenticated using(current_app_role() in ('Admin Total','Admin','Gerencia','Finanzas','Bodega'));
create policy receipt_lines_write_fin_bodega on receipt_lines for all to authenticated using(current_app_role() in ('Admin Total','Admin','Finanzas','Bodega')) with check(current_app_role() in ('Admin Total','Admin','Finanzas','Bodega'));
create policy inventory_read_ops on inventory_movements for select to authenticated using(current_app_role() in ('Admin Total','Admin','Gerencia','Finanzas','Bodega'));
create policy inventory_write_bodega on inventory_movements for insert to authenticated with check(current_app_role() in ('Admin Total','Admin','Bodega'));
create policy materials_read on materials for select to authenticated using(current_app_role() is not null);
create policy materials_price_update_roles on materials for update to authenticated using(current_app_role() in ('Admin Total','Admin','Gerencia','Finanzas')) with check(current_app_role() in ('Admin Total','Admin','Gerencia','Finanzas'));
create policy orders_read on purchase_orders for select to authenticated using(current_app_role() is not null);
create policy orders_update on purchase_orders for update to authenticated using(current_app_role() in ('Admin Total','Admin','Gerencia','Finanzas')) with check(current_app_role() in ('Admin Total','Admin','Gerencia','Finanzas'));
create policy activity_log_insert_own on activity_log for insert to authenticated with check(current_app_role() is not null and actor_id=auth.uid());
