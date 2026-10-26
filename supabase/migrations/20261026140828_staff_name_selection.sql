-- Staff names no longer require an email/account of their own. Existing IDs and data are preserved.
alter table public.staff drop constraint staff_id_fkey;
alter table public.staff alter column id set default gen_random_uuid();

-- Name selection intentionally requires no email, password, or identity approval.
-- A device session chooses an active staff profile; business data stays keyed by that profile.
create table public.staff_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  staff_id uuid not null references public.staff(id)
);
create index staff_sessions_staff_id_idx on public.staff_sessions(staff_id);
alter table public.staff_sessions enable row level security;
revoke all on public.staff_sessions from anon, authenticated;
grant select, insert, update on public.staff_sessions to authenticated;
grant all on public.staff_sessions to service_role;
create policy staff_sessions_read on public.staff_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy staff_sessions_insert on public.staff_sessions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.staff s where s.id = staff_id and s.active));
create policy staff_sessions_update on public.staff_sessions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.staff s where s.id = staff_id and s.active));

-- This internal lookup bypasses only its own session-table RLS to avoid policy recursion.
-- Legacy authenticated staff sessions still resolve to their original staff ID.
create function private.current_staff_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce((select staff_id from public.staff_sessions where user_id = (select auth.uid())), (select auth.uid()));
$$;
revoke all on function private.current_staff_id() from public, anon;
grant execute on function private.current_staff_id() to authenticated;
create or replace function private.is_active_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where id = private.current_staff_id() and active);
$$;
revoke all on function private.is_active_staff() from public, anon;
grant execute on function private.is_active_staff() to authenticated;

-- Active profiles are available before a selection; other application data still needs a selection.
alter policy staff_read on public.staff using (active or (select private.is_active_staff()));
alter policy submissions_insert on public.shift_submissions to authenticated
  with check (staff_id = (select private.current_staff_id()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline));
alter policy submissions_update on public.shift_submissions to authenticated
  using (staff_id = (select private.current_staff_id()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline))
  with check (staff_id = (select private.current_staff_id()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline));
alter policy availability_insert on public.shift_availability to authenticated
  with check (staff_id = (select private.current_staff_id()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline and work_date between p.starts_on and p.ends_on));
alter policy availability_update on public.shift_availability to authenticated
  using (staff_id = (select private.current_staff_id()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline))
  with check (staff_id = (select private.current_staff_id()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline and work_date between p.starts_on and p.ends_on));
alter policy availability_delete on public.shift_availability to authenticated
  using (staff_id = (select private.current_staff_id()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline));
alter policy published_insert on public.published_shifts with check (exists (select 1 from public.staff where id = (select private.current_staff_id()) and active and can_manage_shifts));
alter policy published_update on public.published_shifts using (exists (select 1 from public.staff where id = (select private.current_staff_id()) and active and can_manage_shifts)) with check (exists (select 1 from public.staff where id = (select private.current_staff_id()) and active and can_manage_shifts));
alter policy draft_read on public.shift_schedule_drafts using (exists (select 1 from public.staff where id = (select private.current_staff_id()) and active and can_manage_shifts));
alter policy draft_insert on public.shift_schedule_drafts with check (exists (select 1 from public.staff where id = (select private.current_staff_id()) and active and can_manage_shifts));
alter policy draft_update on public.shift_schedule_drafts using (exists (select 1 from public.staff where id = (select private.current_staff_id()) and active and can_manage_shifts)) with check (exists (select 1 from public.staff where id = (select private.current_staff_id()) and active and can_manage_shifts));

create or replace function private.validate_published_shift() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  p public.shift_periods;
  entry jsonb;
begin
  select * into strict p from public.shift_periods where id = new.period_id;
  if TG_OP = 'UPDATE' then
    if new.period_id <> old.period_id or new.version <> old.version + 1 then
      raise exception 'Invalid schedule version' using errcode = '23514';
    end if;
  elsif new.version <> 1 then
    raise exception 'Invalid initial schedule version' using errcode = '23514';
  end if;
  if jsonb_typeof(new.entries) is distinct from 'array' then
    raise exception 'Expected an array' using errcode = '23514';
  end if;
  for entry in select value from jsonb_array_elements(new.entries) loop
    if jsonb_typeof(entry) is distinct from 'object'
      or not (entry ?& array['staff_id', 'work_date', 'slot'])
      or (entry->>'slot') is null or (entry->>'slot') not in ('lunch', 'dinner', 'both')
      or (entry->>'work_date') is null
      or not ((entry->>'work_date')::date between p.starts_on and p.ends_on)
      or not exists (select 1 from public.staff where id = (entry->>'staff_id')::uuid and active)
    then
      raise exception 'Invalid schedule entry' using errcode = '23514';
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(new.entries) e
    group by (e->>'staff_id')::uuid, (e->>'work_date')::date having count(*) > 1) then
    raise exception 'Duplicate schedule entry' using errcode = '23514';
  end if;
  new.updated_by := private.current_staff_id();
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.validate_published_shift() from public, anon, authenticated;


-- One atomic save, with optimistic concurrency to protect the other editor's changes.
create or replace function public.save_published_shift(p_period_id uuid, p_entries jsonb, p_version integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare saved_version integer;
begin
  if not exists (select 1 from public.staff where id = private.current_staff_id() and active and can_manage_shifts) then
    raise exception 'Shift manager permission required' using errcode = '42501';
  end if;
  if p_version is null or p_version < 0 then
    raise exception 'Invalid expected version' using errcode = '22023';
  end if;
  if p_version = 0 then
    insert into public.published_shifts (period_id, entries, updated_by)
      values (p_period_id, p_entries, private.current_staff_id()) returning version into saved_version;
  else
    update public.published_shifts set entries = p_entries, version = version + 1
      where period_id = p_period_id and version = p_version returning version into saved_version;
    if saved_version is null then
      raise exception 'Schedule changed or permission denied' using errcode = '40001';
    end if;
  end if;
  return saved_version;
end;
$$;
revoke all on function public.save_published_shift(uuid, jsonb, integer) from public, anon;
grant execute on function public.save_published_shift(uuid, jsonb, integer) to authenticated;

create or replace function public.save_shift_availability(p_period_id uuid, p_entries jsonb, p_submit boolean)
returns timestamptz language plpgsql security invoker set search_path = ''
as $$
declare
  actor uuid := private.current_staff_id();
  saved_at timestamptz;
begin
  if actor is null or not private.is_active_staff() then
    raise exception 'Active staff membership required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'Entries must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_entries) > 31 or p_submit is null then
    raise exception 'Invalid submission' using errcode = '22023';
  end if;
  perform 1 from public.shift_periods where id = p_period_id
    and accepting and now() < deadline for share;
  if not found then
    raise exception 'Period is closed or unavailable' using errcode = '42501';
  end if;
  insert into public.shift_submissions(period_id, staff_id)
    values (p_period_id, actor) on conflict do nothing;
  perform 1 from public.shift_submissions
    where period_id = p_period_id and staff_id = actor for update;
  delete from public.shift_availability where period_id = p_period_id and staff_id = actor;
  insert into public.shift_availability(period_id, staff_id, work_date, slot)
    select p_period_id, actor, e.work_date, e.slot
    from jsonb_to_recordset(p_entries) as e(work_date date, slot text);
  saved_at := case when p_submit then now() else null end;
  update public.shift_submissions set submitted_at = saved_at
    where period_id = p_period_id and staff_id = actor;
  return saved_at;
end;
$$;
revoke all on function public.save_shift_availability(uuid, jsonb, boolean) from public, anon;
grant execute on function public.save_shift_availability(uuid, jsonb, boolean) to authenticated;

create or replace function public.save_shift_schedule(
  p_period_id uuid, p_entries jsonb, p_draft_version integer,
  p_published_version integer, p_publish boolean, p_requirements jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_draft_version integer;
  v_published_version integer;
begin
  if not exists (select 1 from public.staff where id = private.current_staff_id() and active and can_manage_shifts) then
    raise exception 'Shift manager permission required' using errcode = '42501';
  end if;
  if p_publish is null or p_draft_version is null or p_draft_version < 0
    or p_published_version is null or p_published_version < 0 then
    raise exception 'Invalid save options' using errcode = '22023';
  end if;
  perform 1 from public.shift_periods where id = p_period_id for update;
  if not found then
    raise exception 'Period unavailable' using errcode = '42501';
  end if;
  select version into v_draft_version from public.shift_schedule_drafts where period_id = p_period_id for update;
  select version into v_published_version from public.published_shifts where period_id = p_period_id for update;
  v_draft_version := coalesce(v_draft_version, 0);
  v_published_version := coalesce(v_published_version, 0);
  if v_draft_version <> p_draft_version or v_published_version <> p_published_version then
    raise exception 'Schedule changed; reload before saving' using errcode = '40001';
  end if;
  if p_publish then
    v_published_version := public.save_published_shift(p_period_id, p_entries, v_published_version);
  end if;
  if v_draft_version = 0 then
    insert into public.shift_schedule_drafts(period_id, entries, published_version, updated_by, requirements)
      values (p_period_id, p_entries, v_published_version, private.current_staff_id(), p_requirements);
  else
    update public.shift_schedule_drafts set entries = p_entries, version = version + 1,
      published_version = v_published_version, requirements = p_requirements where period_id = p_period_id;
  end if;
  return (select jsonb_build_object('draft_version', d.version, 'published_version', d.published_version,
    'updated_by', d.updated_by, 'updated_at', d.updated_at)
    from public.shift_schedule_drafts d where d.period_id = p_period_id);
end;
$$;
revoke all on function public.save_shift_schedule(uuid, jsonb, integer, integer, boolean, jsonb) from public, anon;
grant execute on function public.save_shift_schedule(uuid, jsonb, integer, integer, boolean, jsonb) to authenticated;

