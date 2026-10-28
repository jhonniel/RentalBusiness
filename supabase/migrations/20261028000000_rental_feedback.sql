-- Feedback links an administrator sends after a booking is done.
-- The questions are a snapshot of the rented equipment at send time, so later
-- catalog changes never rewrite what the customer answered. The raw token never
-- lives in the database; public pages look up by uuid and compare a sha256 hash.
-- Server-only (service role). A submitted row is never overwritten. Safe to re-run.

create table if not exists public.rental_feedback_requests (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  token_hash text not null,
  email text,
  questions jsonb not null,
  expires_at timestamptz not null,
  created_by bigint references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  answers jsonb,
  comment text,
  average_rating numeric(3, 2),
  constraint rental_feedback_requests_uuid_unique unique (uuid),
  constraint rental_feedback_requests_token_hash_unique unique (token_hash),
  constraint rental_feedback_requests_hash_check check (char_length(token_hash) = 64),
  constraint rental_feedback_requests_email_check check (email is null or char_length(email) <= 254),
  constraint rental_feedback_requests_questions_check check (jsonb_typeof(questions) = 'array'),
  constraint rental_feedback_requests_comment_check check (comment is null or char_length(comment) <= 2000),
  constraint rental_feedback_requests_rating_check check (average_rating is null or average_rating between 1 and 5),
  constraint rental_feedback_requests_submitted_check check (
    (submitted_at is null and answers is null and average_rating is null)
    or (submitted_at is not null and jsonb_typeof(answers) = 'array' and average_rating is not null)
  )
);

create index if not exists rental_feedback_requests_rental_idx
  on public.rental_feedback_requests (rental_id, created_at desc);

create unique index if not exists rental_feedback_requests_one_submission_idx
  on public.rental_feedback_requests (rental_id)
  where submitted_at is not null;

alter table public.rental_feedback_requests enable row level security;
alter table public.rental_feedback_requests force row level security;

revoke all on public.rental_feedback_requests from anon, authenticated, public;
grant select, insert, update on public.rental_feedback_requests to service_role;

comment on table public.rental_feedback_requests is
  'Customer feedback links sent by an administrator after a booking is done: device-based questions, 1-5 star answers, and a comment. Tokens are stored as sha256 hashes only.';
