alter table public.reports
  add column if not exists client_submission_id uuid;

create unique index if not exists reports_client_submission_id_idx
  on public.reports (client_submission_id)
  where client_submission_id is not null;

create table if not exists public.relief_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  district text not null,
  locality text not null,
  latitude double precision not null check (latitude between 1.0 and 7.0),
  longitude double precision not null check (longitude between 93.0 and 100.0),
  is_open boolean not null default true,
  public_kitchen boolean not null default false,
  clean_water_liters integer not null default 0 check (clean_water_liters >= 0),
  food_portions integer not null default 0 check (food_portions >= 0),
  medicine_kits integer not null default 0 check (medicine_kits >= 0),
  updated_at timestamptz not null default now()
);

alter table public.relief_sites enable row level security;

drop policy if exists "Anyone can read open relief sites" on public.relief_sites;
create policy "Anyone can read open relief sites"
  on public.relief_sites for select to anon, authenticated
  using (is_open);

drop policy if exists "Incident staff can manage relief sites" on public.relief_sites;
create policy "Incident staff can manage relief sites"
  on public.relief_sites for all to authenticated
  using ((select public.is_incident_staff()))
  with check ((select public.is_incident_staff()));

revoke all on public.relief_sites from anon, authenticated;
grant select on public.relief_sites to anon, authenticated;
grant insert, update, delete on public.relief_sites to authenticated;

create table if not exists public.emergency_signals (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude between 1.0 and 7.0),
  longitude double precision not null check (longitude between 93.0 and 100.0),
  status text not null default 'pending'
    check (status in ('pending', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists emergency_signals_status_created_idx
  on public.emergency_signals (status, created_at desc);
create unique index if not exists emergency_signals_one_active_per_reporter_idx
  on public.emergency_signals (reporter_id)
  where status in ('pending', 'acknowledged');

alter table public.emergency_signals enable row level security;

drop policy if exists "Owners and staff can read emergency signals" on public.emergency_signals;
create policy "Owners and staff can read emergency signals"
  on public.emergency_signals for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select public.is_incident_staff())
  );

drop policy if exists "Users can create their own emergency signals" on public.emergency_signals;
create policy "Users can create their own emergency signals"
  on public.emergency_signals for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'pending');

drop policy if exists "Incident staff can update emergency signals" on public.emergency_signals;
create policy "Incident staff can update emergency signals"
  on public.emergency_signals for update to authenticated
  using ((select public.is_incident_staff()))
  with check ((select public.is_incident_staff()));

revoke all on public.emergency_signals from anon, authenticated;
grant select, insert, update on public.emergency_signals to authenticated;

create table if not exists public.volunteer_locations (
  volunteer_id uuid primary key references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude between 1.0 and 7.0),
  longitude double precision not null check (longitude between 93.0 and 100.0),
  updated_at timestamptz not null default now()
);

alter table public.volunteer_locations enable row level security;

drop policy if exists "Volunteers manage their own location" on public.volunteer_locations;
create policy "Volunteers manage their own location"
  on public.volunteer_locations for all to authenticated
  using (
    volunteer_id = (select auth.uid())
    and (select public.current_user_role()) = 'volunteer'
  )
  with check (
    volunteer_id = (select auth.uid())
    and (select public.current_user_role()) = 'volunteer'
  );

revoke all on public.volunteer_locations from anon, authenticated;
grant select, insert, update, delete on public.volunteer_locations to authenticated;

create table if not exists public.volunteer_notifications (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  report_id uuid not null references public.reports (id) on delete cascade,
  report_code text not null,
  incident_type text not null,
  district text not null,
  locality text not null,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (volunteer_id, report_id)
);

create index if not exists volunteer_notifications_recipient_created_idx
  on public.volunteer_notifications (volunteer_id, created_at desc);

alter table public.volunteer_notifications enable row level security;

drop policy if exists "Volunteers can read their notifications" on public.volunteer_notifications;
create policy "Volunteers can read their notifications"
  on public.volunteer_notifications for select to authenticated
  using (volunteer_id = (select auth.uid()));

drop policy if exists "Volunteers can mark their notifications read" on public.volunteer_notifications;
create policy "Volunteers can mark their notifications read"
  on public.volunteer_notifications for update to authenticated
  using (volunteer_id = (select auth.uid()))
  with check (volunteer_id = (select auth.uid()));

revoke all on public.volunteer_notifications from anon, authenticated;
grant select, update (read_at) on public.volunteer_notifications to authenticated;

create or replace function public.broadcast_verified_report_to_nearby_volunteers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'verified' and old.status is distinct from new.status then
    insert into public.volunteer_notifications (
      volunteer_id,
      report_id,
      report_code,
      incident_type,
      district,
      locality,
      latitude,
      longitude
    )
    select
      location.volunteer_id,
      new.id,
      new.report_code,
      new.incident_type,
      new.district,
      new.locality,
      new.latitude,
      new.longitude
    from public.volunteer_locations location
    where location.updated_at >= now() - interval '2 hours'
      and 6371 * 2 * asin(sqrt(least(1,
        power(sin(radians(location.latitude - new.latitude) / 2), 2)
        + cos(radians(new.latitude)) * cos(radians(location.latitude))
        * power(sin(radians(location.longitude - new.longitude) / 2), 2)
      ))) <= 5
    on conflict (volunteer_id, report_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_verified_report_broadcast on public.reports;
create trigger on_verified_report_broadcast
  after update of status on public.reports
  for each row execute function public.broadcast_verified_report_to_nearby_volunteers();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'emergency_signals'
    ) then
      alter publication supabase_realtime add table public.emergency_signals;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'relief_sites'
    ) then
      alter publication supabase_realtime add table public.relief_sites;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'volunteer_notifications'
    ) then
      alter publication supabase_realtime add table public.volunteer_notifications;
    end if;
  end if;
end;
$$;
