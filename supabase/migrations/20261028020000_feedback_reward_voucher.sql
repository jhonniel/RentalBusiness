-- Thank-you voucher for completed feedback.
-- The admin picks one voucher from Admin › Vouchers (settings key 'feedback_reward').
-- When a customer rates every question and leaves a comment, and that voucher still
-- has stock (its Max uses), the server saves it on the feedback row in the same update
-- as the answers. Counting these rows tells how many codes were given. Safe to re-run.

alter table public.rental_feedback_requests
  add column if not exists reward_voucher_id bigint references public.vouchers (id);

drop index if exists public.rental_feedback_requests_reward_voucher_idx;

create index if not exists rental_feedback_requests_reward_voucher_idx
  on public.rental_feedback_requests (reward_voucher_id)
  where reward_voucher_id is not null;

comment on column public.rental_feedback_requests.reward_voucher_id is
  'Voucher given to the customer for completing this feedback with a comment.';
