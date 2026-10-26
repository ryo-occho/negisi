begin;
create extension if not exists pgtap with schema extensions;
select plan(22);
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000101'),
 ('00000000-0000-0000-0000-000000000102'),
 ('00000000-0000-0000-0000-000000000103'),
 ('00000000-0000-0000-0000-000000000104');
insert into public.staff(id, display_name, can_manage_shifts) values
 ('00000000-0000-0000-0000-000000000101', 'Rumi test', true),
 ('00000000-0000-0000-0000-000000000102', 'Hirokun test', true),
 ('00000000-0000-0000-0000-000000000103', 'Regular test', false);
insert into public.shift_periods(id, starts_on, ends_on, deadline) values
 ('00000000-0000-0000-0000-000000000110', '2098-02-16', '2098-02-28', '2098-02-15T12:00:00+09:00');
set local role anon;
select throws_ok('select * from public.published_shifts', '42501', null, 'Anonymous cannot read schedules');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '[]', 0)$$, '42501', null, 'Anonymous cannot publish');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select throws_ok($$update public.staff set can_manage_shifts = true where id = '00000000-0000-0000-0000-000000000103'$$, '42501', null, 'Cannot grant oneself manager rights');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '[]', 0)$$, '42501', null, 'Regular staff cannot publish');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select is(public.save_published_shift('00000000-0000-0000-0000-000000000110', '[{"staff_id":"00000000-0000-0000-0000-000000000103","work_date":"2098-02-16","slot":"lunch"}]', 0), 1, 'Rumi can publish');
select is((select updated_by from public.published_shifts where period_id = '00000000-0000-0000-0000-000000000110'), '00000000-0000-0000-0000-000000000101'::uuid, 'Publisher is recorded by database');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select is((select entries->0->>'slot' from public.published_shifts where period_id = '00000000-0000-0000-0000-000000000110'), 'lunch', 'Regular staff sees published schedule');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '[]', 1)$$, '42501', null, 'Regular staff cannot replace schedule');
update public.published_shifts set entries = '[]', version = 2 where period_id = '00000000-0000-0000-0000-000000000110';
select is((select version from public.published_shifts where period_id = '00000000-0000-0000-0000-000000000110'), 1, 'Direct update by regular staff has no effect');
select throws_ok($$delete from public.published_shifts$$, '42501', null, 'Deletion is not exposed');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
select is((select count(*) from public.published_shifts), 0::bigint, 'Non-member cannot read');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '[]', 0)$$, '42501', null, 'Non-member cannot publish');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select is(public.save_published_shift('00000000-0000-0000-0000-000000000110', '[{"staff_id":"00000000-0000-0000-0000-000000000103","work_date":"2098-02-16","slot":"both"}]', 1), 2, 'Hirokun can edit schedule');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '[]', 1)$$, '40001', null, 'Stale save cannot overwrite newer schedule');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '[{"staff_id":"00000000-0000-0000-0000-000000000103","work_date":"2098-03-01","slot":"lunch"}]', 2)$$, '23514', null, 'Out-of-period date rejected');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '[{"staff_id":"00000000-0000-0000-0000-000000000103","work_date":"2098-02-16","slot":"either"}]', 2)$$, '23514', null, 'Availability-only slot rejected');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '[{"staff_id":"00000000-0000-0000-0000-000000000103","work_date":"2098-02-16","slot":"lunch"},{"staff_id":"00000000-0000-0000-0000-000000000103","work_date":"2098-02-16","slot":"dinner"}]', 2)$$, '23514', null, 'Duplicate staff and date rejected');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '{}', 2)$$, '23514', null, 'Malformed payload rejected');
select is((select version from public.published_shifts where period_id = '00000000-0000-0000-0000-000000000110'), 2, 'Failed saves preserve schedule');
reset role;
update public.staff set active = false where id = '00000000-0000-0000-0000-000000000102';
set local role authenticated;
select is((select count(*) from public.published_shifts), 0::bigint, 'Suspended manager cannot read');
select throws_ok($$select public.save_published_shift('00000000-0000-0000-0000-000000000110', '[]', 2)$$, '42501', null, 'Suspended manager cannot save');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select is(public.save_published_shift('00000000-0000-0000-0000-000000000110', '[]', 2), 3, 'Manager can publish all-off schedule');
select * from finish();
rollback;
