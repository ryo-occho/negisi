-- The selected active shift manager controls survey dates and acceptance.
-- Staff can still read all surveys and submit their own availability.
alter policy periods_insert on public.shift_periods
  with check (exists (
    select 1 from public.staff
    where id = (select private.current_staff_id())
      and active and can_manage_shifts
  ));

alter policy periods_update on public.shift_periods
  using (exists (
    select 1 from public.staff
    where id = (select private.current_staff_id())
      and active and can_manage_shifts
  ))
  with check (exists (
    select 1 from public.staff
    where id = (select private.current_staff_id())
      and active and can_manage_shifts
  ));
