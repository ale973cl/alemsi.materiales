alter table public.supplier_materials add column if not exists supplier_code text;

create or replace view public.material_master_catalog as
with inventory as (
  select material_id, coalesce(sum(signed_quantity),0::numeric) as availability
  from public.inventory_movements
  group by material_id
), preferred_supplier as (
  select distinct on (sm.material_id)
    sm.material_id,
    coalesce(nullif(s.fantasy_name,''),s.legal_name) as supplier,
    coalesce(nullif(sm.supplier_code,''),m.supplier_code) as supplier_code,
    sm.net_price as supplier_net_price
  from public.supplier_materials sm
  join public.suppliers s on s.id=sm.supplier_id and s.active=true
  join public.materials m on m.id=sm.material_id
  where sm.active=true
  order by sm.material_id, coalesce(sm.priority,999999), sm.effective_from desc nulls last, sm.id
)
select
  m.id,
  m.family,
  ps.supplier,
  coalesce(ps.supplier_code,m.supplier_code) as supplier_code,
  m.name as product,
  m.presentation,
  m.unit,
  coalesce(ps.supplier_net_price,m.current_net_price,0::numeric) as net_value,
  coalesce(i.availability,0::numeric) as availability,
  m.active,
  m.price_review_required,
  m.updated_at
from public.materials m
left join inventory i on i.material_id=m.id
left join preferred_supplier ps on ps.material_id=m.id;
