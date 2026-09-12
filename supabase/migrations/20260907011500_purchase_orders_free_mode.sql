-- Extiende órdenes de compra sin alterar el flujo existente de abastecimiento.
-- Las OC originadas en consolidado siguen usando supply_run_id/material_id.
-- Las OC libres pueden existir sin campaña, abastecimiento ni material maestro.

alter table public.purchase_orders
  alter column supply_run_id drop not null;

alter table public.purchase_orders
  add column if not exists order_type text not null default 'Abastecimiento',
  add column if not exists currency text not null default 'CLP',
  add column if not exists payment_terms text,
  add column if not exists delivery_terms text,
  add column if not exists billing_address text,
  add column if not exists delivery_address text,
  add column if not exists conditions text,
  add column if not exists observations text,
  add column if not exists vat_rate numeric not null default 19,
  add column if not exists vat_amount numeric not null default 0,
  add column if not exists total_amount numeric not null default 0;

alter table public.purchase_order_lines
  alter column material_id drop not null;

alter table public.purchase_order_lines
  add column if not exists line_type text not null default 'Material',
  add column if not exists description text,
  add column if not exists unit text,
  add column if not exists supplier_code text;

update public.purchase_orders
set order_type = 'Abastecimiento'
where order_type is null;

update public.purchase_orders
set vat_amount = round(coalesce(total_net,0) * coalesce(vat_rate,19) / 100),
    total_amount = coalesce(total_net,0) + round(coalesce(total_net,0) * coalesce(vat_rate,19) / 100)
where coalesce(total_amount,0)=0 and coalesce(total_net,0)>0;

comment on column public.purchase_orders.order_type is 'Abastecimiento = desde consolidado; Libre = compra administrativa/servicio sin campaña.';
comment on column public.purchase_order_lines.description is 'Descripción libre para servicios, software u otros conceptos no vinculados al maestro de materiales.';
