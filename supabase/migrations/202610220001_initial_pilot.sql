create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role text not null default 'citizen'
    check (role in ('admin', 'officer', 'citizen', 'volunteer')),
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Pengguna SiagaKita'),
    case
      when new.raw_user_meta_data ->> 'requested_role' = 'volunteer' then 'volunteer'
      else 'citizen'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_incident_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('admin', 'officer'), false)
$$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  report_code text not null unique default (
    'SK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  reporter_id uuid not null references public.profiles (id),
  incident_type text not null check (
    incident_type in ('Banjir', 'Tanah longsor', 'Gempa bumi', 'Kebakaran', 'Angin kencang', 'Lainnya')
  ),
  district text not null check (
    district in (
      'Kabupaten Aceh Barat',
      'Kabupaten Aceh Barat Daya',
      'Kabupaten Aceh Besar',
      'Kabupaten Aceh Jaya',
      'Kabupaten Aceh Selatan',
      'Kabupaten Aceh Singkil',
      'Kabupaten Aceh Tamiang',
      'Kabupaten Aceh Tengah',
      'Kabupaten Aceh Tenggara',
      'Kabupaten Aceh Timur',
      'Kabupaten Aceh Utara',
      'Kabupaten Bener Meriah',
      'Kabupaten Bireuen',
      'Kabupaten Gayo Lues',
      'Kabupaten Nagan Raya',
      'Kabupaten Pidie',
      'Kabupaten Pidie Jaya',
      'Kabupaten Simeulue',
      'Kota Banda Aceh',
      'Kota Langsa',
      'Kota Lhokseumawe',
      'Kota Sabang',
      'Kota Subulussalam'
    )
  ),
  locality text not null check (char_length(locality) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  latitude double precision not null check (latitude between 1.0 and 7.0),
  longitude double precision not null check (longitude between 93.0 and 100.0),
  evidence_path text check (
    evidence_path is null or (
      split_part(evidence_path, '/', 1) = reporter_id::text
      and array_length(string_to_array(evidence_path, '/'), 1) = 2
      and char_length(evidence_path) <= 200
    )
  ),
  status text not null default 'pending' check (
    status in ('pending', 'verified', 'in_progress', 'resolved', 'rejected')
  ),
  verified_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  from_status text,
  to_status text not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists reports_reporter_created_idx
  on public.reports (reporter_id, created_at desc);
create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);
create index if not exists report_events_report_created_idx
  on public.report_events (report_id, created_at);

create or replace function public.record_new_report_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.report_events (report_id, actor_id, from_status, to_status)
  values (new.id, new.reporter_id, null, new.status);
  return new;
end;
$$;

drop trigger if exists on_report_created on public.reports;
create trigger on_report_created
  after insert on public.reports
  for each row execute function public.record_new_report_event();

create or replace function public.published_incident_map()
returns table (
  id uuid,
  report_code text,
  incident_type text,
  district text,
  latitude double precision,
  longitude double precision,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.report_code,
    r.incident_type,
    r.district,
    round(r.latitude::numeric, 2)::double precision,
    round(r.longitude::numeric, 2)::double precision,
    r.status
  from public.reports r
  where r.status in ('verified', 'in_progress', 'resolved')
  order by r.created_at desc
$$;

create or replace function public.review_incident_report(
  p_report_id uuid,
  p_next_status text,
  p_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_report public.reports;
  updated_report public.reports;
begin
  if not public.is_incident_staff() then
    raise exception 'Hanya petugas berwenang yang dapat mengubah status laporan.'
      using errcode = '42501';
  end if;

  if p_next_status not in ('verified', 'in_progress', 'resolved', 'rejected') then
    raise exception 'Status tujuan tidak valid.' using errcode = '22023';
  end if;

  select * into current_report
  from public.reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Laporan tidak ditemukan.' using errcode = 'P0002';
  end if;

  if not (
    (current_report.status = 'pending' and p_next_status in ('verified', 'rejected'))
    or (current_report.status = 'verified' and p_next_status in ('in_progress', 'rejected'))
    or (current_report.status = 'in_progress' and p_next_status in ('resolved', 'rejected'))
  ) then
    raise exception 'Perubahan status tersebut tidak diizinkan.' using errcode = '22023';
  end if;

  update public.reports
  set status = p_next_status,
      verified_by = (select auth.uid()),
      updated_at = now()
  where id = p_report_id
  returning * into updated_report;

  insert into public.report_events (report_id, actor_id, from_status, to_status, note)
  values (
    p_report_id,
    (select auth.uid()),
    current_report.status,
    p_next_status,
    nullif(trim(p_note), '')
  );

  return updated_report;
end;
$$;

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_events enable row level security;

drop policy if exists "Users can read their own profile and staff can read all" on public.profiles;
create policy "Users can read their own profile and staff can read all"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.current_user_role()) in ('admin', 'officer')
  );

drop policy if exists "Users can update their own name" on public.profiles;
create policy "Users can update their own name"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

drop policy if exists "Reporters and staff can read reports" on public.reports;
create policy "Reporters and staff can read reports"
  on public.reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select public.is_incident_staff())
  );

drop policy if exists "Authenticated users can submit their own reports" on public.reports;
create policy "Authenticated users can submit their own reports"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'pending');

drop policy if exists "Staff can update reports" on public.reports;
create policy "Staff can update reports"
  on public.reports for update to authenticated
  using ((select public.is_incident_staff()))
  with check ((select public.is_incident_staff()));

revoke all on public.reports from anon, authenticated;
grant select, insert on public.reports to authenticated;
revoke insert on public.reports from authenticated;
grant insert (
  reporter_id,
  incident_type,
  district,
  locality,
  description,
  latitude,
  longitude,
  evidence_path,
  status
) on public.reports to authenticated;
drop policy if exists "Report participants and staff can read status history" on public.report_events;
create policy "Report participants and staff can read status history"
  on public.report_events for select to authenticated
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_id
        and (r.reporter_id = (select auth.uid()) or (select public.is_incident_staff()))
    )
  );

revoke all on public.report_events from anon, authenticated;
grant select on public.report_events to authenticated;

revoke all on function public.review_incident_report(uuid, text, text) from public;
grant execute on function public.review_incident_report(uuid, text, text) to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_incident_staff() to authenticated;
revoke all on function public.published_incident_map() from public;
grant execute on function public.published_incident_map() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-evidence',
  'report-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload evidence to their own folder" on storage.objects;
create policy "Users upload evidence to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Report owners and staff can read evidence" on storage.objects;
create policy "Report owners and staff can read evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'report-evidence'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_incident_staff())
    )
  );

drop policy if exists "Users can remove their unlinked evidence" on storage.objects;
create policy "Users can remove their unlinked evidence"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'report-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.reports r where r.evidence_path = name)
  );
