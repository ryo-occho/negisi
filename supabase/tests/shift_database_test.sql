-- Run only on a disposable/local database. All fixture changes are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
insert into auth.users (id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
insert into public.staff (id, display_name) values
 ('00000000-0000-0000-0000-000000000001', 'Test A'),
 ('00000000-0000-0000-0000-000000000002', 'Test B');
insert into public.shift_periods (id, starts_on, ends_on, deadline) values
 ('00000000-0000-0000-0000-000000000010', '2099-02-16', '2099-02-28', '2099-02-15T12:00:00+09:00');
select throws_ok($$insert into public.shift_periods (starts_on, ends_on, deadline)
 values ('2099-02-01', '2099-02-14', '2099-01-30T00:00:00Z')$$,
 '23514', null, 'Invalid half-month rejected');
set local role anon;
select throws_ok('select * from public.staff', '42501', null, 'Anonymous access denied');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.staff), 0::bigint, 'Non-member sees no staff');
select throws_ok($$insert into public.shift_submissions (period_id, staff_id)
 values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003')$$,
 '42501', null, 'Non-member write denied');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.staff), 2::bigint, 'Staff can see colleagues');
select lives_ok($$insert into public.shift_submissions (period_id, staff_id, submitted_at)
 values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', now())$$,
 'Empty availability can be submitted');
select throws_ok($$insert into public.shift_submissions (period_id, staff_id)
 values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002')$$,
 '42501', null, 'Cannot submit for colleague');
select lives_ok($$insert into public.shift_availability values
 ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '2099-02-16', 'either')$$,
 'Own availability accepted');
select ok((select submitted_at is null from public.shift_submissions), 'Editing requires resubmission');
select throws_ok($$insert into public.shift_availability values
 ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '2099-03-01', 'lunch')$$,
 '42501', null, 'Date outside period rejected');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.shift_availability), 1::bigint, 'Colleague can read availability');
update public.shift_availability set slot = 'dinner';
select is((select slot from public.shift_availability), 'either', 'Cannot edit colleague availability');
select throws_ok($$update public.shift_periods set starts_on = '2099-03-16', ends_on = '2099-03-31'$$,
 '23514', null, 'Period dates cannot move');
update public.shift_periods set accepting = false;
select throws_ok($$insert into public.shift_availability values
 ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', '2099-02-16', 'lunch')$$,
 '42501', null, 'Closed period rejects editing');
select * from finish();
rollback;
