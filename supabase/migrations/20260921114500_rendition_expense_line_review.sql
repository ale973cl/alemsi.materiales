-- Revisión por línea de gastos de Rendiciones.
-- Aplicada en Supabase como rendition_expense_line_review.
alter table public.rendition_expenses
  add column if not exists review_status text not null default 'Pendiente'
  check (review_status in ('Pendiente','Observada','Aprobada','Rechazada'));

create index if not exists idx_rendition_expenses_review_status
  on public.rendition_expenses(review_status);
