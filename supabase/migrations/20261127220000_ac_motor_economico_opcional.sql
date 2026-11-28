-- ALEMSI · Motor económico optativo. NO ejecutar sobre base compartida sin autorización.
-- Contratos existentes quedan sin control activo. No altera validaciones operativas.
begin;
alter table public.contracts
  add column if not exists control_economico_activo boolean not null default false,
  add column if not exists frecuencia_ciclo_meses smallint,
  add column if not exists dias_anticipacion_alerta smallint;
alter table public.contracts drop constraint if exists ac_ciclo_frecuencia_check;
alter table public.contracts add constraint ac_ciclo_frecuencia_check check (frecuencia_ciclo_meses is null or frecuencia_ciclo_meses between 1 and 24);
alter table public.contracts drop constraint if exists ac_ciclo_alerta_check;
alter table public.contracts add constraint ac_ciclo_alerta_check check (dias_anticipacion_alerta is null or dias_anticipacion_alerta between 0 and 365);

create table if not exists public.ac_contrato_presupuesto_mensual (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contracts(id) on delete cascade,
  mes text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  techo_neto_clp numeric(16,2) not null check (techo_neto_clp >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique(contrato_id,mes)
);
create index if not exists ac_presupuesto_mes_idx on public.ac_contrato_presupuesto_mensual(mes,contrato_id);

create table if not exists public.ac_plantillas_curva_presupuesto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  tipo text not null check (tipo in ('plana','decreciente','estacional','variable')),
  montos_neto_clp jsonb not null check (jsonb_typeof(montos_neto_clp)='array'),
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
-- Cada posición del arreglo es el mes relativo de la plantilla.
create table if not exists public.ac_campana_periodo (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references public.campaigns(id) on delete cascade,
  contrato_id uuid not null references public.contracts(id) on delete cascade,
  mes_inicio text not null check (mes_inicio ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  mes_fin text not null check (mes_fin ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  check (mes_inicio <= mes_fin),
  unique(campana_id,contrato_id)
);

alter table public.dispatch_lines add column if not exists costo_unitario_congelado_clp numeric(16,4)
  check (costo_unitario_congelado_clp is null or costo_unitario_congelado_clp >= 0);
alter table public.dispatch_lines add column if not exists costo_congelado_en timestamptz;
create table if not exists public.ac_guia_imputacion_mensual (
  id uuid primary key default gen_random_uuid(),
  guia_id uuid not null references public.dispatches(id) on delete cascade,
  linea_guia_id uuid not null references public.dispatch_lines(id) on delete cascade,
  contrato_id uuid not null references public.contracts(id) on delete cascade,
  mes text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  importe_neto_clp numeric(16,4) not null,
  clase text not null check (clase in ('campana','extraordinaria')),
  creado_en timestamptz not null default now(),
  unique(linea_guia_id,mes)
);
create index if not exists ac_imputacion_contrato_mes_idx on public.ac_guia_imputacion_mensual(contrato_id,mes);

-- Una devolución solo descuenta al acreditarse el movimiento físico positivo.
create table if not exists public.ac_devoluciones_materiales (
  id uuid primary key default gen_random_uuid(),
  linea_guia_id uuid not null references public.dispatch_lines(id) on delete restrict,
  movimiento_inventario_id uuid not null unique references public.inventory_movements(id) on delete restrict,
  cantidad_reingresada numeric(16,4) not null check(cantidad_reingresada>0),
  observacion text,
  creado_en timestamptz not null default now()
);

-- Impedir registros económicos manuales que exceden una devolución física real.
create or replace function public.ac_validar_devolucion()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_stock record;v_line record;v_prev numeric;
begin
 select material_id,signed_quantity,movement_type into v_stock from public.inventory_movements where id=new.movimiento_inventario_id;
 select material_id,delivered_qty into v_line from public.dispatch_lines where id=new.linea_guia_id;
 if v_stock.material_id is distinct from v_line.material_id or coalesce(v_stock.signed_quantity,0)<=0
   or v_stock.movement_type not in ('return','receipt','adjustment') or new.cantidad_reingresada>v_stock.signed_quantity then
  raise exception 'La devolución debe corresponder a un reingreso físico acreditado del mismo material';
 end if;
 select coalesce(sum(cantidad_reingresada),0) into v_prev from public.ac_devoluciones_materiales
  where linea_guia_id=new.linea_guia_id and id is distinct from new.id;
 if v_prev+new.cantidad_reingresada>coalesce(v_line.delivered_qty,0) then
  raise exception 'La devolución supera lo recibido por la instalación';
 end if;
 return new;
end $$;
drop trigger if exists ac_validar_devolucion_trg on public.ac_devoluciones_materiales;
create trigger ac_validar_devolucion_trg before insert or update on public.ac_devoluciones_materiales
for each row execute function public.ac_validar_devolucion();

-- Facturas de proveedores: solo metadatos optativos de crédito, nunca bloquean la recepción.
create table if not exists public.ac_factura_credito (
  factura_id uuid primary key references public.receipts(id) on delete cascade,
  condicion_pago text not null default 'Crédito' check(condicion_pago in ('Contado','Crédito','Sin Costo')),
  dias_credito integer not null default 30 check(dias_credito between 0 and 3650),
  fecha_emision date,
  fecha_recepcion_sii date,
  fecha_vencimiento date generated always as
    (case when condicion_pago='Crédito' and fecha_recepcion_sii is not null
     then fecha_recepcion_sii + dias_credito else null end) stored,
  fecha_limite_reclamo date generated always as
    (case when fecha_recepcion_sii is not null then fecha_recepcion_sii + 8 else null end) stored,
  actualizado_en timestamptz not null default now()
);
create table if not exists public.ac_factura_pagos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.receipts(id) on delete cascade,
  monto_clp numeric(16,2) not null check (monto_clp>0),
  fecha_pago date not null,
  referencia text not null check (length(btrim(referencia))>0),
  acreditado boolean not null default false,
  creado_en timestamptz not null default now()
);
create index if not exists ac_pagos_factura_idx on public.ac_factura_pagos(factura_id) where acreditado=true;

-- Funciones invocador y control explícito de acceso; las políticas no permiten acceso anónimo.
create or replace function public.ac_perfil_habilitado(p_escritura boolean default false)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.user_profiles u where u.id=(select auth.uid()) and u.active
   and u.role = any(case when p_escritura
     then array['Admin Total','Gerencia','Admin']
     else array['Admin Total','Gerencia','Admin','Finanzas'] end));
$$;

alter table public.ac_contrato_presupuesto_mensual enable row level security;
alter table public.ac_plantillas_curva_presupuesto enable row level security;
alter table public.ac_campana_periodo enable row level security;
alter table public.ac_guia_imputacion_mensual enable row level security;
alter table public.ac_devoluciones_materiales enable row level security;
alter table public.ac_factura_credito enable row level security;
alter table public.ac_factura_pagos enable row level security;
do $$
declare t text;
begin
 foreach t in array array['ac_contrato_presupuesto_mensual','ac_plantillas_curva_presupuesto',
  'ac_campana_periodo','ac_guia_imputacion_mensual','ac_devoluciones_materiales',
  'ac_factura_credito','ac_factura_pagos'] loop
  execute format('drop policy if exists ac_lectura on public.%I',t);
  execute format('drop policy if exists ac_escritura on public.%I',t);
  execute format('create policy ac_lectura on public.%I for select to authenticated using (public.ac_perfil_habilitado(false))',t);
  execute format('create policy ac_escritura on public.%I for all to authenticated using (public.ac_perfil_habilitado(true)) with check (public.ac_perfil_habilitado(true))',t);
 end loop;
end $$;

-- Triggers aditivos. El económico inactivo no toca las líneas históricas.
create or replace function public.ac_congelar_precio_guia()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_contrato uuid; v_activo boolean; v_precio numeric;
begin
 if tg_op='UPDATE' then
  if old.costo_unitario_congelado_clp is not null and
     new.costo_unitario_congelado_clp is distinct from old.costo_unitario_congelado_clp then
   raise exception 'Costo histórico de guía inmutable';
  end if;
  return new;
 end if;
 select coalesce(d.contract_id,i.contract_id),coalesce(c.control_economico_activo,false)
  into v_contrato,v_activo from public.dispatches d
  join public.installations i on i.id=d.installation_id
  join public.contracts c on c.id=i.contract_id where d.id=new.dispatch_id;
 if not coalesce(v_activo,false) then return new; end if;
 if new.costo_unitario_congelado_clp is null then
  select current_net_price into v_precio from public.materials where id=new.material_id;
  if v_precio is not null and v_precio>=0 then
   new.costo_unitario_congelado_clp:=v_precio;
   new.costo_congelado_en:=now();
  end if;
 end if;
 return new;
end $$;
drop trigger if exists ac_congelar_precio_guia_trg on public.dispatch_lines;
create trigger ac_congelar_precio_guia_trg before insert or update of costo_unitario_congelado_clp
on public.dispatch_lines for each row execute function public.ac_congelar_precio_guia();

-- Ledger auxiliar: no modifica estados/stock/OC. El faltante de configuración se omite.
-- Convención: el consumo ocurre al emitirse una guía, no cuando se compra su material.
create schema if not exists ac_private;
revoke all on schema ac_private from public, anon, authenticated;

create or replace function ac_private.ac_imputar_linea_guia()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_contrato uuid; v_activo boolean; v_campana uuid; v_fecha date;
  v_base numeric; v_suma numeric; v_total numeric; v_resto numeric;
  v_mes record; v_n integer:=0; v_count integer; v_clase text;
begin
 select i.contract_id,c.control_economico_activo,d.campaign_id,
   coalesce(d.dispatched_at::date,d.created_at::date)
 into v_contrato,v_activo,v_campana,v_fecha
 from public.dispatches d
 join public.installations i on i.id=d.installation_id
 join public.contracts c on c.id=i.contract_id where d.id=new.dispatch_id;
 if not coalesce(v_activo,false) or new.costo_unitario_congelado_clp is null
   or v_fecha is null then return new; end if;
 v_base:=round(coalesce(new.required_qty,0)*new.costo_unitario_congelado_clp,4);
 if v_base<=0 then return new; end if;
 if v_campana is null then
  insert into public.ac_guia_imputacion_mensual(guia_id,linea_guia_id,contrato_id,mes,importe_neto_clp,clase)
  values(new.dispatch_id,new.id,v_contrato,to_char(v_fecha,'YYYY-MM'),v_base,'extraordinaria')
  on conflict(linea_guia_id,mes) do nothing;
  return new;
 end if;
 select sum(p.techo_neto_clp),count(*) into v_suma,v_count
 from public.ac_campana_periodo cp join public.ac_contrato_presupuesto_mensual p
  on p.contrato_id=cp.contrato_id and p.mes between cp.mes_inicio and cp.mes_fin
 where cp.campana_id=v_campana and cp.contrato_id=v_contrato;
 if coalesce(v_suma,0)<=0 or v_count=0 then return new; end if;
 -- Sin todos los meses configurados no se prorratea una curva parcial.
 if v_count <> ((substring((select mes_fin from public.ac_campana_periodo where campana_id=v_campana and contrato_id=v_contrato),1,4)::int - substring((select mes_inicio from public.ac_campana_periodo where campana_id=v_campana and contrato_id=v_contrato),1,4)::int)*12 + (substring((select mes_fin from public.ac_campana_periodo where campana_id=v_campana and contrato_id=v_contrato),6,2)::int - substring((select mes_inicio from public.ac_campana_periodo where campana_id=v_campana and contrato_id=v_contrato),6,2)::int)+1) then return new; end if;
 v_resto:=v_base;
 for v_mes in
  select p.mes,p.techo_neto_clp from public.ac_campana_periodo cp
  join public.ac_contrato_presupuesto_mensual p
    on p.contrato_id=cp.contrato_id and p.mes between cp.mes_inicio and cp.mes_fin
  where cp.campana_id=v_campana and cp.contrato_id=v_contrato order by p.mes
 loop
   v_n:=v_n+1;
   v_total:=case when v_n=v_count then v_resto
           else round(v_base*v_mes.techo_neto_clp/v_suma,4) end;
   v_resto:=v_resto-v_total;
   insert into public.ac_guia_imputacion_mensual(guia_id,linea_guia_id,contrato_id,mes,importe_neto_clp,clase)
   values(new.dispatch_id,new.id,v_contrato,v_mes.mes,v_total,'campana')
   on conflict(linea_guia_id,mes) do nothing;
 end loop;
 return new;
exception when others then
 -- Si falla el motor económico, jamás impide la guía: se concilia posteriormente.
 raise warning 'ALEMSI ac_imputar_linea_guia: %',sqlerrm;
 return new;
end $$;
drop trigger if exists ac_imputar_linea_guia_trg on public.dispatch_lines;
create trigger ac_imputar_linea_guia_trg after insert on public.dispatch_lines
for each row execute function ac_private.ac_imputar_linea_guia();
revoke all on function ac_private.ac_imputar_linea_guia() from public, anon, authenticated;

-- Vistas con privilegios de invocador (PostgreSQL 15+): RLS de las tablas base.
create or replace view public.ac_v_resumen_mensual with (security_invoker=true) as
with gastado as (
 select a.contrato_id,a.mes,
  sum(case when d.status='Anulado' then 0 else a.importe_neto_clp end) as guias_neto
 from public.ac_guia_imputacion_mensual a
 join public.dispatches d on d.id=a.guia_id
 group by a.contrato_id,a.mes
),reintegros as (
 select a.contrato_id,a.mes,
  sum(case when d.status='Anulado' then 0 else
    a.importe_neto_clp * r.cantidad_reingresada/nullif(dl.required_qty,0) end) as retorno_neto
 from public.ac_devoluciones_materiales r
 join public.dispatch_lines dl on dl.id=r.linea_guia_id
 join public.dispatches d on d.id=dl.dispatch_id
 join public.ac_guia_imputacion_mensual a on a.linea_guia_id=dl.id
 join public.inventory_movements im on im.id=r.movimiento_inventario_id
 where im.signed_quantity>0 and im.material_id=dl.material_id
 group by a.contrato_id,a.mes
)
select p.contrato_id,c.client_id,p.mes,p.techo_neto_clp,
 coalesce(g.guias_neto,0) as guias_neto,
 coalesce(r.retorno_neto,0) as retornos_neto,
 coalesce(g.guias_neto,0)-coalesce(r.retorno_neto,0) as gastado_neto,
 p.techo_neto_clp-coalesce(g.guias_neto,0)+coalesce(r.retorno_neto,0) as saldo_neto
from public.ac_contrato_presupuesto_mensual p
join public.contracts c on c.id=p.contrato_id and c.control_economico_activo=true
left join gastado g on g.contrato_id=p.contrato_id and g.mes=p.mes
left join reintegros r on r.contrato_id=p.contrato_id and r.mes=p.mes;

create or replace view public.ac_v_facturas_vencimiento with (security_invoker=true) as
select r.id as factura_id,r.supplier_id,r.document_folio,r.document_type,
 r.document_total,fc.condicion_pago,fc.dias_credito,fc.fecha_recepcion_sii,
 fc.fecha_vencimiento,fc.fecha_limite_reclamo,
 coalesce((select sum(p.monto_clp) from public.ac_factura_pagos p
  where p.factura_id=r.id and p.acreditado=true),0) as pagado_acreditado_clp
from public.receipts r join public.ac_factura_credito fc on fc.factura_id=r.id;

-- Sin concesiones de escritura para anon. Data API: permitir a autenticados; RLS y autorización real en políticas.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.ac_contrato_presupuesto_mensual,
 public.ac_plantillas_curva_presupuesto,public.ac_campana_periodo,
 public.ac_guia_imputacion_mensual,public.ac_devoluciones_materiales,
 public.ac_factura_credito,public.ac_factura_pagos to authenticated;
grant select on public.ac_v_resumen_mensual,public.ac_v_facturas_vencimiento to authenticated;
grant execute on function public.ac_perfil_habilitado(boolean) to authenticated;
revoke all on function public.ac_validar_devolucion() from public, anon, authenticated;
commit;