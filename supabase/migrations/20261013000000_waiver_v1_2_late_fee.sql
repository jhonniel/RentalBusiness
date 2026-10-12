-- Publish JRY-WAIVER-v1.2 with the late-return schedule.
-- Accepted JRY-WAIVER-v1.0 and JRY-WAIVER-v1.1 snapshots stay frozen.

insert into public.waiver_versions (version, title, body, is_current, published_at)
select
  'JRY-WAIVER-v1.2',
  title,
  replace(
    replace(
      replace(
        body,
        'Agreement version: JRY-WAIVER-v1.1',
        'Agreement version: JRY-WAIVER-v1.2'
      ),
      'Late returns may result in additional rental charges.',
      'A return after the agreed return time is a late return and is charged under section 14.'
    ),
    E'14. LATE RETURN\nIf equipment is not returned on time, JRY Rentals may charge additional rental fees according to the applicable rental rate and booking terms.',
    E'14. LATE RETURN\nA late fee applies once the equipment is not returned by the agreed return time.\n\nLess than 6 hours after the return time, the late fee is ₱300.00.\n\n6 hours or more, and up to 12 hours, after the return time, the late fee is half a day of the rented item.\n\nMore than 12 hours after the return time, the late return is charged as 1 day of rent.'
  ),
  false,
  timezone('utc', now())
from public.waiver_versions
where version = 'JRY-WAIVER-v1.1'
on conflict (version) do nothing;

update public.waiver_versions
set body = replace(
  body,
  '6 hours or more, and up to 12 hours, after the return time, the late fee is ₱500.00.',
  '6 hours or more, and up to 12 hours, after the return time, the late fee is half a day of the rented item.'
)
where version = 'JRY-WAIVER-v1.2'
  and body like '%the late fee is ₱500.00.%';

update public.waiver_versions
set is_current = false
where is_current = true
  and version is distinct from 'JRY-WAIVER-v1.2'
  and exists (
    select 1
    from public.waiver_versions
    where version = 'JRY-WAIVER-v1.2'
  );

update public.waiver_versions
set is_current = true
where version = 'JRY-WAIVER-v1.2';
