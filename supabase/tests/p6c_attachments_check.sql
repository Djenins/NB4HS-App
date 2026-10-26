-- Checks for p6c_report_attachments (after p6a). Run AFTER the migrations,
-- inside the same transaction. Always ends by raising
-- 'P6C_CHECKS_PASSED ...', so nothing is committed.
--
-- Uploads are simulated by inserting storage.objects rows as the signed-in
-- user, which is what the Storage API does under these same policies.
do $$
declare
  admin uuid := (select id from public.profiles where role = 'administrator' and active order by created_at limit 1);
  staff uuid := (select id from public.profiles where role = 'staff' and active order by created_at limit 1);
  cm uuid := (select id from public.profiles where role = 'case_manager' and active order by created_at limit 1);
  v_period uuid;
  v_report uuid;
  paths text[] := '{}';
  p text;
  n int;
  msg text;
begin
  if admin is null or staff is null or cm is null then
    raise exception 'need an active administrator, staff member and case manager to run these checks';
  end if;
  perform public.ensure_reporting_periods();
  select id into v_period from public.reporting_periods order by period_start limit 1;
  insert into public.program_staff (user_id, program, program_role, active) values (cm, 'staff_reports', 'reviewer', true)
  on conflict (user_id, program) do update set program_role = 'reviewer', active = true;

  if (select public from storage.buckets where id = 'staff-report-files') is distinct from false
     or (select file_size_limit from storage.buckets where id = 'staff-report-files') <> 10485760 then
    raise exception 'FAIL: the bucket is missing, public, or has the wrong size limit';
  end if;
  if public.staff_report_path_report('not-a-path') is not null
     or public.staff_report_path_report(gen_random_uuid() || '/../etc') is not null then
    raise exception 'FAIL: a malformed path was accepted';
  end if;

  -- ---------------- the author uploads and lists up to 5 ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.staff_reports (period_id, programs, activities, accomplishments, challenges, no_assistance_needed, next_goals)
  values (v_period, array['organization'], 'A', 'B', 'C', true, 'D') returning id into v_report;
  for i in 1..5 loop
    p := v_report || '/' || gen_random_uuid() || '-file' || i || '.pdf';
    insert into storage.objects (bucket_id, name, owner, metadata) values ('staff-report-files', p, staff, '{"size": 1000, "mimetype": "application/pdf"}');
    insert into public.staff_report_attachments (report_id, storage_path, file_name, mime_type, size_bytes)
    values (v_report, p, 'file' || i || '.pdf', 'application/pdf', 1000);
    paths := array_append(paths, p);
  end loop;
  msg := null;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('staff-report-files', v_report || '/' || gen_random_uuid() || '-six.pdf', staff);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a sixth file was uploaded'; end if;
  msg := null;
  begin
    insert into public.staff_report_attachments (report_id, storage_path, file_name, mime_type, size_bytes)
    values (v_report, v_report || '/' || gen_random_uuid() || '-ghost.pdf', 'ghost.pdf', 'application/pdf', 10);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: listed a file that was never uploaded'; end if;
  msg := null;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('staff-report-files', 'loose-file.pdf', staff);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: uploaded outside a report folder'; end if;
  reset role;

  -- ---------------- nobody else sees a draft's files ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', cm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.staff_report_attachments where report_id = v_report;
  if n <> 0 then raise exception 'FAIL: a reviewer saw a draft''s files'; end if;
  select count(*) into n from storage.objects where bucket_id = 'staff-report-files' and name = any (paths);
  if n <> 0 then raise exception 'FAIL: a reviewer could download a draft''s file'; end if;
  msg := null;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('staff-report-files', v_report || '/' || gen_random_uuid() || '-x.pdf', cm);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: someone uploaded into another person''s report'; end if;
  reset role;

  -- ---------------- after submission: frozen; readable by reviewers only ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if not public.staff_report_attachment_removable(paths[1]) then
    raise exception 'FAIL: the author cannot remove a draft''s file';
  end if;
  perform public.submit_staff_report(v_report);
  if public.staff_report_attachment_removable(paths[1]) or public.staff_report_attachable(v_report) then
    raise exception 'FAIL: files can still change after submission';
  end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', cm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'staff-report-files' and name = any (paths);
  if n <> 5 then raise exception 'FAIL: the reviewer cannot download the submitted files (% of 5)', n; end if;
  perform public.request_staff_report_revision(v_report, 'Please add the sign-in sheet');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'staff-report-files' and name = any (paths);
  if n <> 0 then raise exception 'FAIL: a non-reviewer administrator could download report files'; end if;
  reset role;

  -- ---------------- during a revision: earlier files stay ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.staff_report_attachment_removable(paths[1]) then
    raise exception 'FAIL: a file the reviewer already saw can be removed';
  end if;
  reset role;

  raise exception 'P6C_CHECKS_PASSED files follow their report; 5-file cap; frozen on submit; earlier files kept on revision';
end;
$$;
