alter table public.installations
  add column if not exists surface_m2 numeric;

comment on column public.installations.surface_m2 is 'Superficie de la instalación en metros cuadrados';
