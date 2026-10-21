-- Membership is provisioned through trusted tooling, never self-enrolled.
create table public.staff (
  id uuid primary key references auth.users(id),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  active boolean not null default true
);

create table public.shift_periods (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null unique,
  ends_on date not null,
  deadline timestamptz not null,
  accepting boolean not null default true,
  check (extract(day from starts_on) in (1, 16)),
  check (ends_on = case when extract(day from starts_on) = 1
    then starts_on + 14
    else (date_trunc('month', starts_on) + interval '1 month - 1 day')::date end),
  check (deadline <= starts_on::timestamp at time zone 'Asia/Tokyo')
);

create table public.shift_submissions (
  period_id uuid not null references public.shift_periods(id),
  staff_id uuid not null references public.staff(id),
  submitted_at timestamptz,
  primary key (period_id, staff_id)
);
create index shift_submissions_staff_id_idx on public.shift_submissions(staff_id);

-- No row means unavailable. 'either' means either slot, not two shifts.
create table public.shift_availability (
  period_id uuid not null,
  staff_id uuid not null,
  work_date date not null,
  slot text not null check (slot in ('lunch', 'dinner', 'either')),
  primary key (period_id, staff_id, work_date),
  foreign key (period_id, staff_id)
    references public.shift_submissions(period_id, staff_id)
);
create index shift_availability_staff_id_idx on public.shift_availability(staff_id);

alter table public.staff enable row level security;
alter table public.shift_periods enable row level security;
alter table public.shift_submissions enable row level security;
alter table public.shift_availability enable row level security;

revoke all on public.staff, public.shift_periods, public.shift_submissions,
  public.shift_availability from anon, authenticated;
grant select on public.staff to authenticated;
grant select, insert, update on public.shift_periods to authenticated;
grant select, insert, update on public.shift_submissions to authenticated;
grant select, insert, update, delete on public.shift_availability to authenticated;
grant all on public.staff, public.shift_periods, public.shift_submissions,
  public.shift_availability to service_role;

-- Reading one's membership avoids recursive RLS; other names are shared only with members.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create function private.is_active_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.staff where id = (select auth.uid()) and active); $$;
revoke all on function private.is_active_staff() from public, anon;
grant execute on function private.is_active_staff() to authenticated;

create policy staff_read on public.staff for select to authenticated
  using ((select private.is_active_staff()));
create policy periods_read on public.shift_periods for select to authenticated
  using ((select private.is_active_staff()));
create policy periods_insert on public.shift_periods for insert to authenticated
  with check ((select private.is_active_staff()));
create policy periods_update on public.shift_periods for update to authenticated
  using ((select private.is_active_staff())) with check ((select private.is_active_staff()));

create policy submissions_read on public.shift_submissions for select to authenticated
  using ((select private.is_active_staff()));
create policy submissions_insert on public.shift_submissions for insert to authenticated
  with check (staff_id = (select auth.uid()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline));
create policy submissions_update on public.shift_submissions for update to authenticated
  using (staff_id = (select auth.uid()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline))
  with check (staff_id = (select auth.uid()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline));

create policy availability_read on public.shift_availability for select to authenticated
  using ((select private.is_active_staff()));
create policy availability_insert on public.shift_availability for insert to authenticated
  with check (staff_id = (select auth.uid()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline and work_date between p.starts_on and p.ends_on));
create policy availability_update on public.shift_availability for update to authenticated
  using (staff_id = (select auth.uid()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline))
  with check (staff_id = (select auth.uid()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline and work_date between p.starts_on and p.ends_on));
create policy availability_delete on public.shift_availability for delete to authenticated
  using (staff_id = (select auth.uid()) and (select private.is_active_staff())
    and exists (select 1 from public.shift_periods p where p.id = period_id
      and p.accepting and now() < p.deadline));

create function private.invalidate_submission() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if TG_OP in ('UPDATE', 'DELETE') then
    update public.shift_submissions set submitted_at = null
      where period_id = old.period_id and staff_id = old.staff_id;
  end if;
  if TG_OP in ('INSERT', 'UPDATE') then
    update public.shift_submissions set submitted_at = null
      where period_id = new.period_id and staff_id = new.staff_id;
  end if;
  return null;
end;
$$;
revoke all on function private.invalidate_submission() from public, anon, authenticated;
create trigger availability_changed after insert or update or delete on public.shift_availability
  for each row execute function private.invalidate_submission();

create function private.protect_period_dates() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on then
    raise exception 'Period dates cannot be changed; create a new period' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_period_dates() from public, anon, authenticated;
create trigger protect_period_dates before update on public.shift_periods
  for each row execute function private.protect_period_dates();
