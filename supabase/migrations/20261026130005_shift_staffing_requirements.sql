alter table public.shift_schedule_drafts add column requirements jsonb not null default '{}'::jsonb;

create function private.validate_staffing_requirements() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  period public.shift_periods;
  item record;
  amount jsonb;
begin
  select * into strict period from public.shift_periods where id = new.period_id;
  if jsonb_typeof(new.requirements) is distinct from 'object' then
    raise exception 'Requirements must be an object' using errcode = '23514';
  end if;
  for item in select * from jsonb_each(new.requirements) loop
    if item.key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or item.key::date not between period.starts_on and period.ends_on
      or jsonb_typeof(item.value) is distinct from 'object' then
      raise exception 'Invalid requirement date' using errcode = '23514';
    end if;
    for amount in select value from jsonb_each(item.value) loop
      if amount <> 'null'::jsonb then
        if jsonb_typeof(amount) is distinct from 'number' then
          raise exception 'Invalid staffing count' using errcode = '23514';
        end if;
        if amount::text::numeric < 0 or amount::text::numeric > 99
          or trunc(amount::text::numeric) <> amount::text::numeric then
          raise exception 'Invalid staffing count' using errcode = '23514';
        end if;
      end if;
    end loop;
    if exists (select 1 from jsonb_object_keys(item.value) k where k not in ('lunch', 'dinner')) then
      raise exception 'Invalid staffing slot' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.validate_staffing_requirements() from public, anon, authenticated;
create trigger validate_staffing_requirements before insert or update on public.shift_schedule_drafts
  for each row execute function private.validate_staffing_requirements();

drop function public.save_shift_schedule(uuid, jsonb, integer, integer, boolean);
create function public.save_shift_schedule(
  p_period_id uuid, p_entries jsonb, p_draft_version integer,
  p_published_version integer, p_publish boolean, p_requirements jsonb
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
    insert into public.shift_schedule_drafts(period_id, entries, published_version, updated_by, requirements)
      values (p_period_id, p_entries, v_published_version, auth.uid(), p_requirements);
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
