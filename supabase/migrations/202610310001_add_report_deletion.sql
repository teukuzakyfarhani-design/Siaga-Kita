grant delete on public.reports to authenticated;

drop policy if exists "Owners and staff can delete reports" on public.reports;
create policy "Owners and staff can delete reports"
  on public.reports for delete to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select public.is_incident_staff())
  );

drop policy if exists "Owners and staff can remove deleted evidence" on storage.objects;
create policy "Owners and staff can remove deleted evidence"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'report-evidence'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_incident_staff())
    )
    and not exists (select 1 from public.reports r where r.evidence_path = name)
  );
