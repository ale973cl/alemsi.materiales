alter table public.receipts alter column purchase_order_id drop not null;
alter table public.receipts add column if not exists supplier_id uuid references public.suppliers(id);
alter table public.receipts add column if not exists document_type text;
alter table public.receipts add column if not exists document_folio text;
alter table public.receipts add column if not exists document_date date;
alter table public.receipts add column if not exists document_net numeric not null default 0;
alter table public.receipts add column if not exists document_total numeric not null default 0;
alter table public.receipts add column if not exists no_oc_reason text;
alter table public.receipts add column if not exists reconciliation_status text not null default 'Pendiente cotejo';
alter table public.receipts add column if not exists inventory_posted boolean not null default false;
alter table public.receipts add column if not exists reconciled_by uuid references auth.users(id);
alter table public.receipts add column if not exists reconciled_at timestamptz;
create index if not exists receipts_document_folio_idx on public.receipts(document_folio);
create index if not exists receipts_supplier_id_idx on public.receipts(supplier_id);
create index if not exists receipts_reconciliation_status_idx on public.receipts(reconciliation_status);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='receipts_document_type_check') then alter table public.receipts add constraint receipts_document_type_check check (document_type is null or document_type in ('Factura','Boleta','Guía de despacho','Otro')); end if;
 if not exists(select 1 from pg_constraint where conname='receipts_reconciliation_status_check') then alter table public.receipts add constraint receipts_reconciliation_status_check check (reconciliation_status in ('Pendiente cotejo','Conforme','Con diferencia','Confirmada sin OC')); end if;
end $$;
