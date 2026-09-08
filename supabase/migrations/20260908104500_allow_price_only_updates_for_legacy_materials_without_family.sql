-- Legacy materials without family must remain editable for non-structural fields such as price.
-- Structural edits and new materials still require a family.
alter table public.materials drop constraint if exists materials_family_required;

create or replace function public.enforce_material_family_on_structural_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.family is null or btrim(new.family) = '' then
      raise exception 'La familia es obligatoria para nuevos materiales';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (
      new.name is distinct from old.name or
      new.family is distinct from old.family or
      new.presentation is distinct from old.presentation or
      new.unit is distinct from old.unit or
      new.supplier_code is distinct from old.supplier_code or
      new.active is distinct from old.active
    ) and (new.family is null or btrim(new.family) = '') then
      raise exception 'La familia es obligatoria para modificar la ficha del material';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists materials_require_family_on_structural_change on public.materials;
create trigger materials_require_family_on_structural_change
before insert or update on public.materials
for each row execute function public.enforce_material_family_on_structural_change();
