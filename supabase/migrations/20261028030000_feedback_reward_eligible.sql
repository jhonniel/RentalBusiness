-- Feedback thank-you voucher: per-link choice and unique codes.
-- 1. reward_eligible: the admin decides when sending a link whether that feedback can
--    earn the voucher. Existing links keep earning it.
-- 2. Unique codes: the voucher chosen in Admin › Vouchers is a template. Each customer
--    who earns it gets their own single-use voucher (reward_voucher_id) copied from the
--    template (reward_source_voucher_id). The template's Max uses is how many codes can
--    be given; the trigger below refuses one more, even when two customers submit at once.
-- Safe to re-run.

alter table public.rental_feedback_requests
  add column if not exists reward_eligible boolean not null default true;

alter table public.rental_feedback_requests
  add column if not exists reward_source_voucher_id bigint references public.vouchers (id);

create index if not exists rental_feedback_requests_reward_source_idx
  on public.rental_feedback_requests (reward_source_voucher_id)
  where reward_source_voucher_id is not null;

create or replace function public.limit_feedback_reward_codes()
returns trigger
language plpgsql
as $$
declare
  v_limit integer;
  v_given integer;
begin
  if new.reward_source_voucher_id is null
    or new.reward_source_voucher_id is not distinct from old.reward_source_voucher_id then
    return new;
  end if;

  select max_redemptions into v_limit
  from public.vouchers
  where id = new.reward_source_voucher_id
  for update;

  if v_limit is not null then
    select count(*) into v_given
    from public.rental_feedback_requests
    where reward_source_voucher_id = new.reward_source_voucher_id;

    if v_given >= v_limit then
      raise exception 'All feedback voucher codes have been given out.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rental_feedback_requests_limit_reward_codes on public.rental_feedback_requests;
create trigger rental_feedback_requests_limit_reward_codes
before update on public.rental_feedback_requests
for each row execute function public.limit_feedback_reward_codes();

comment on column public.rental_feedback_requests.reward_eligible is
  'Set by the admin when sending the link: true if this feedback can earn the thank-you voucher.';
comment on column public.rental_feedback_requests.reward_source_voucher_id is
  'The template voucher (Admin › Vouchers) the unique thank-you code was copied from.';
