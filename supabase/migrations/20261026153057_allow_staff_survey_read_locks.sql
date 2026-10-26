-- SELECT ... FOR SHARE in save_shift_availability also evaluates UPDATE USING.
-- Allow active staff to lock the survey while saving their own availability.
-- Keep the manager-only WITH CHECK from restrict_survey_period_management:
-- any actual INSERT/UPDATE still requires an active shift manager.
alter policy periods_update on public.shift_periods
  using ((select private.is_active_staff()));
