-- Shared workspace for shift managers; staff continue to read published_shifts only.
create table public.shift_schedule_drafts (
  period_id uuid primary key references public.shift_periods(id),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  version integer not null default 1 check (version > 0),
  published_version integer not null default 0 check (published_version >= 0),
  updated_by uuid not null references public.staff(id),
  updated_at timestamptz not null default now()
);
alter table public.shift_schedule_drafts enable row level security;
revoke all on public.shift_schedule_drafts from anon, authenticated;
grant select, insert, update on public.shift_schedule_drafts to authenticated;
grant all on public.shift_schedule_drafts to service_role;

create policy draft_read on public.shift_schedule_drafts for select to authenticated
  using (exists (select 1 from public.staff where id = (select auth.uid()) and active and can_manage_shifts));
create policy draft_insert on public.shift_schedule_drafts for insert to authenticated
  with check (exists (select 1 from public.staff where id = (select auth.uid()) and active and can_manage_shifts));
create policy draft_update on public.shift_schedule_drafts for update to authenticated
  using (exists (select 1 from public.staff where id = (select auth.uid()) and active and can_manage_shifts))
  with check (exists (select 1 from public.staff where id = (select auth.uid()) and active and can_manage_shifts));
create trigger validate_schedule_draft before insert or update on public.shift_schedule_drafts
  for each row execute function private.validate_published_shift();

-- Serialize saves for a period and atomically publish only after checking both versions.
create function public.save_shift_schedule(
  p_period_id uuid, p_entries jsonb, p_draft_version integer,
  p_published_version integer, p_publish boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_draft_version integer;
  v_published_version integer;
begin
  if not exists (select 1 from public.staff where id = auth.uid() and active and can_manage_shifts) then
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
    insert into public.shift_schedule_drafts(period_id, entries, published_version, updated_by)
      values (p_period_id, p_entries, v_published_version, auth.uid());
  else
    update public.shift_schedule_drafts set entries = p_entries, version = version + 1,
      published_version = v_published_version where period_id = p_period_id;
  end if;
  return (select jsonb_build_object('draft_version', d.version, 'published_version', d.published_version,
    'updated_by', d.updated_by, 'updated_at', d.updated_at)
    from public.shift_schedule_drafts d where d.period_id = p_period_id);
end;
$$;
revoke all on function public.save_shift_schedule(uuid, jsonb, integer, integer, boolean) from public, anon;
grant execute on function public.save_shift_schedule(uuid, jsonb, integer, integer, boolean) to authenticated;
