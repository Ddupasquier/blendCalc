-- Additive access boundary. Billing owns grants; browsers can only read their own state.
create table public.user_ad_free_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_ad_free_access_finite_expiry check (isfinite(expires_at)),
  constraint user_ad_free_access_finite_revocation check (revoked_at is null or isfinite(revoked_at))
);
alter table public.user_ad_free_access enable row level security;
create policy own_ad_free_access on public.user_ad_free_access for select
  to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_ad_free_access from public, anon, authenticated;
grant select on public.user_ad_free_access to authenticated;
grant all on public.user_ad_free_access to service_role;
create trigger set_user_ad_free_access_updated_at before update on public.user_ad_free_access
  for each row execute function public.set_updated_at();

create function public.read_current_user_advertising_access()
returns text language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.user_ad_free_access
    where user_id = auth.uid() and revoked_at is null and expires_at > now()) then
    return 'ad-free';
  end if;
  return 'supported';
end;
$$;
revoke all on function public.read_current_user_advertising_access() from public, anon;
grant execute on function public.read_current_user_advertising_access() to authenticated, service_role;
comment on table public.user_ad_free_access is 'Private server-managed, time-bounded ad-free access. No checkout or client write path.';
