-- Legacy email-auth storage. Kept for reference; use personal-sync.sql now.
-- Run this once in the Supabase SQL Editor.

create table if not exists public.roadready_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint roadready_profile_is_object check (jsonb_typeof(profile) = 'object')
);

alter table public.roadready_profiles enable row level security;

revoke all on table public.roadready_profiles from anon;
grant select, insert, update, delete on table public.roadready_profiles to authenticated;

do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roadready_profiles'
      and policyname = 'RoadReady users can read their profile'
  ) then
    create policy "RoadReady users can read their profile"
    on public.roadready_profiles for select to authenticated
    using ((select auth.uid()) = user_id);
  end if;
end
$policy$;

do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roadready_profiles'
      and policyname = 'RoadReady users can create their profile'
  ) then
    create policy "RoadReady users can create their profile"
    on public.roadready_profiles for insert to authenticated
    with check ((select auth.uid()) = user_id);
  end if;
end
$policy$;

do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roadready_profiles'
      and policyname = 'RoadReady users can update their profile'
  ) then
    create policy "RoadReady users can update their profile"
    on public.roadready_profiles for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  end if;
end
$policy$;
