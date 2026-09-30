-- Personal sync without Supabase Auth. Existing roadready_profiles is untouched.
begin;
create schema if not exists private;
create table if not exists private.roadready_device_profiles (
  key_hash text primary key,
  profile jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(profile) = 'object'),
  check (octet_length(profile::text) <= 2097152)
);
alter table private.roadready_device_profiles enable row level security;
revoke all on private.roadready_device_profiles from public, anon, authenticated;

-- The privileged functions live in a non-exposed schema. Only the hash of the
-- random 256-bit device key is stored; callers cannot list other profiles.
create or replace function private.roadready_read_progress(p_sync_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_row private.roadready_device_profiles%rowtype;
begin
  if p_sync_key is null or p_sync_key !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'Invalid device key' using errcode = '22023';
  end if;
  select * into v_row from private.roadready_device_profiles
  where key_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_sync_key, 'UTF8')), 'hex');
  return jsonb_build_object('profile', v_row.profile, 'revision', coalesce(v_row.revision, 0), 'updated_at', v_row.updated_at);
end;
$$;

create or replace function private.roadready_write_progress(
  p_sync_key text, p_profile jsonb, p_expected_revision bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_row private.roadready_device_profiles%rowtype;
  v_saved boolean;
begin
  if p_sync_key is null or p_sync_key !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'Invalid device key' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
    or p_profile is null or jsonb_typeof(p_profile) <> 'object'
    or jsonb_typeof(p_profile->'questionProgress') is distinct from 'object'
    or jsonb_typeof(p_profile->'sessions') is distinct from 'array'
    or octet_length(p_profile::text) > 2097152 then
    raise exception 'Invalid progress payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_profile->'sessions') > 100 then
    raise exception 'Too many stored sessions' using errcode = '22023';
  end if;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_sync_key, 'UTF8')), 'hex');
  if p_expected_revision = 0 then
    insert into private.roadready_device_profiles(key_hash, profile)
    values (v_hash, p_profile) on conflict (key_hash) do nothing
    returning * into v_row;
  else
    update private.roadready_device_profiles
    set profile = p_profile, revision = revision + 1, updated_at = clock_timestamp()
    where key_hash = v_hash and revision = p_expected_revision
    returning * into v_row;
  end if;
  v_saved := found;
  if not v_saved then
    select * into v_row from private.roadready_device_profiles where key_hash = v_hash;
  end if;
  return jsonb_build_object('saved', v_saved, 'profile', v_row.profile,
    'revision', coalesce(v_row.revision, 0), 'updated_at', v_row.updated_at);
end;
$$;

revoke all on function private.roadready_read_progress(text) from public;
revoke all on function private.roadready_write_progress(text, jsonb, bigint) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.roadready_read_progress(text) to anon, authenticated;
grant execute on function private.roadready_write_progress(text, jsonb, bigint) to anon, authenticated;

-- Public wrappers are invokers, not privileged security-definer functions.
create or replace function public.roadready_read_progress(p_sync_key text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.roadready_read_progress(p_sync_key);
$$;
create or replace function public.roadready_write_progress(
  p_sync_key text, p_profile jsonb, p_expected_revision bigint
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.roadready_write_progress(p_sync_key, p_profile, p_expected_revision);
$$;
revoke all on function public.roadready_read_progress(text) from public;
revoke all on function public.roadready_write_progress(text, jsonb, bigint) from public;
grant execute on function public.roadready_read_progress(text) to anon, authenticated;
grant execute on function public.roadready_write_progress(text, jsonb, bigint) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
