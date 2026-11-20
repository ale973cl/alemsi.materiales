-- Permitir campañas de múltiples contratos sin atribuirlas falsamente a uno solo.
-- Las relaciones reales permanecen en campaign_installations -> installations -> contracts.
-- Las campañas de un solo contrato conservan su contract_id existente.
alter table public.campaigns alter column contract_id drop not null;

comment on column public.campaigns.contract_id is
'Contrato opcional: se informa solo cuando la campaña corresponde a un único contrato. Para campañas multicontrato, resolver cada contrato desde campaign_installations.installation_id -> installations.contract_id.';
