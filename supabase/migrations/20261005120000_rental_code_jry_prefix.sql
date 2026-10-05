-- Public rental numbers use the JRY brand prefix.

create or replace function public.generate_rental_code()
returns text
language sql
as $$
  select 'JRY-'
    || to_char(timezone('Asia/Manila', now()), 'YYYYMMDD')
    || '-'
    || lpad(nextval('public.rental_code_seq')::text, 5, '0');
$$;

set lumen.sync_rental_totals = 'on';

update public.rental_requests
set code = 'JRY-' || substr(code, 5)
where code like 'LUM-%';

reset lumen.sync_rental_totals;

comment on column public.rental_requests.code is 'Public rental number (JRY-YYYYMMDD-#####).';
