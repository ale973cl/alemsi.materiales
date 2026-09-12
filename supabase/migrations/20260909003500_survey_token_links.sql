alter table public.campaign_installations
  add column if not exists survey_token_hash text,
  add column if not exists survey_token_expires_at timestamptz,
  add column if not exists survey_token_email text,
  add column if not exists survey_token_created_at timestamptz,
  add column if not exists survey_token_created_by uuid references public.user_profiles(id),
  add column if not exists survey_token_used_at timestamptz;

create unique index if not exists campaign_installations_survey_token_hash_uq
  on public.campaign_installations(survey_token_hash)
  where survey_token_hash is not null;

create index if not exists campaign_installations_survey_token_expires_idx
  on public.campaign_installations(survey_token_expires_at)
  where survey_token_hash is not null;
