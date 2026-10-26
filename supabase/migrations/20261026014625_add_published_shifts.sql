alter table public.staff add column can_manage_shifts boolean not null default false;

create table public.published_shifts (
  period_id uuid primary key references public.shift_periods(id),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  version integer not null default 1 check (version > 0),
  updated_by uuid not null references public.staff(id),
  updated_at timestamptz not null default now()
);
alter table public.published_shifts enable row level security;
revoke all on public.published_shifts from anon, authenticated;
grant select, insert, update on public.published_shifts to authenticated;
grant all on public.published_shifts to service_role;

create policy published_read on public.published_shifts for select to authenticated
  using ((select private.is_active_staff()));
create policy published_insert on public.published_shifts for insert to authenticated
  with check (exists (select 1 from public.staff where id = (select auth.uid()) and active and can_manage_shifts));
create policy published_update on public.published_shifts for update to authenticated
  using (exists (select 1 from public.staff where id = (select auth.uid()) and active and can_manage_shifts))
  with check (exists (select 1 from public.staff where id = (select auth.uid()) and active and can_manage_shifts));

-- Validate direct API writes as well as RPC calls; membership cannot be edited by clients.
create function private.validate_published_shift() returns trigger
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
  new.updated_by := auth.uid();
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.validate_published_shift() from public, anon, authenticated;
create trigger validate_published_shift before insert or update on public.published_shifts
  for each row execute function private.validate_published_shift();

-- One atomic save, with optimistic concurrency to protect the other editor's changes.
create function public.save_published_shift(p_period_id uuid, p_entries jsonb, p_version integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare saved_version integer;
begin
  if not exists (select 1 from public.staff where id = auth.uid() and active and can_manage_shifts) then
    raise exception 'Shift manager permission required' using errcode = '42501';
  end if;
  if p_version is null or p_version < 0 then
    raise exception 'Invalid expected version' using errcode = '22023';
  end if;
  if p_version = 0 then
    insert into public.published_shifts (period_id, entries, updated_by)
      values (p_period_id, p_entries, auth.uid()) returning version into saved_version;
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
