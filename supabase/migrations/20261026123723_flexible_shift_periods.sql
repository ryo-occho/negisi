-- Allow any inclusive date range within a month. Existing periods retain their IDs and data.
alter table public.shift_periods
  drop constraint shift_periods_starts_on_check,
  drop constraint shift_periods_check,
  drop constraint shift_periods_starts_on_key;
alter table public.shift_periods
  add constraint shift_periods_date_range_check check (
    ends_on >= starts_on and date_trunc('month', starts_on) = date_trunc('month', ends_on)
  ),
  add constraint shift_periods_date_range_key unique (starts_on, ends_on);

-- Save an entire date range atomically, using the caller's existing RLS permissions.
create or replace function public.save_shift_availability(p_period_id uuid, p_entries jsonb, p_submit boolean)
returns timestamptz language plpgsql security invoker set search_path = ''
as $$
declare
  actor uuid := auth.uid();
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
