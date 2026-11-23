-- La OC y el abastecimiento no imputan gasto contractual.
-- El contrato se determina al entregar mediante guía de despacho.
alter table public.supply_runs alter column contract_id drop not null;
comment on column public.supply_runs.contract_id is 'Opcional para campañas multicontrato. No imputar costo de compra a contrato; usar guía de entrega e instalación.';
