-- Lock feedback once the customer has answered it.
-- One submission per link: after submitted_at is set, the row can never be changed,
-- even by the service role. Once a booking has an answer, no new link can be created
-- for it. Unanswered links can still be expired. Safe to re-run.

create or replace function public.lock_submitted_feedback()
returns trigger
language plpgsql
as $$
begin
  if old.submitted_at is not null then
    raise exception 'This feedback was already submitted and cannot be changed.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists rental_feedback_requests_lock_submitted on public.rental_feedback_requests;
create trigger rental_feedback_requests_lock_submitted
before update on public.rental_feedback_requests
for each row execute function public.lock_submitted_feedback();

create or replace function public.block_feedback_after_submission()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.rental_feedback_requests
    where rental_id = new.rental_id
      and submitted_at is not null
  ) then
    raise exception 'This customer already sent feedback for this booking.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists rental_feedback_requests_block_after_submission on public.rental_feedback_requests;
create trigger rental_feedback_requests_block_after_submission
before insert on public.rental_feedback_requests
for each row execute function public.block_feedback_after_submission();

revoke delete on public.rental_feedback_requests from service_role;
