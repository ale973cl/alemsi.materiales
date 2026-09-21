revoke execute on function public.has_additional_service_access(text) from anon;
revoke execute on function public.has_additional_service_access(text) from public;
grant execute on function public.has_additional_service_access(text) to authenticated;

create index if not exists idx_additional_service_user_access_user_id on public.additional_service_user_access(user_id);
create index if not exists idx_additional_service_user_access_granted_by on public.additional_service_user_access(granted_by);
create index if not exists idx_additional_services_configured_by on public.additional_services(configured_by);
