-- Legacy rows without family remain visible for normalization, but every new/updated material must have a family.
alter table public.materials
  add constraint materials_family_required
  check (family is not null and btrim(family) <> '') not valid;
