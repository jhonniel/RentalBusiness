-- FAQs managed by admins. Active FAQs show on the public /faq page and teach the chat support.
-- Anyone can read active FAQs; only admins can add, edit, hide, reorder, or delete them.
-- Seeds a starter set the first time. Safe to re-run.

create table if not exists public.faqs (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint faqs_uuid_unique unique (uuid),
  constraint faqs_question_check check (char_length(question) between 3 and 200),
  constraint faqs_answer_check check (char_length(answer) between 1 and 2000)
);

create index if not exists faqs_active_sort_idx
  on public.faqs (is_active, sort_order, created_at);

drop trigger if exists faqs_set_updated_at on public.faqs;
create trigger faqs_set_updated_at
before update on public.faqs
for each row execute function public.set_updated_at();

alter table public.faqs enable row level security;
alter table public.faqs force row level security;

revoke all on public.faqs from anon, authenticated, public;
grant select on public.faqs to anon, authenticated;
grant insert, update, delete on public.faqs to authenticated;
grant select, insert, update, delete on public.faqs to service_role;

drop policy if exists faqs_public_read on public.faqs;
create policy faqs_public_read
on public.faqs for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists faqs_admin_write on public.faqs;
create policy faqs_admin_write
on public.faqs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.faqs (question, answer, sort_order)
select seed.question, seed.answer, seed.sort_order
from (values
  ('How do I book?', 'Choose the equipment and your pickup and return dates, sign the rental agreement, take a photo of a government ID and a selfie, then submit your request. After that, open the booking in My rentals and pay on the Pay page.', 10),
  ('What do I need to rent?', 'A valid government-issued ID and a selfie, both taken during booking, plus a signed rental agreement.', 20),
  ('What payment methods do you accept?', 'You can pay with the methods shown on the Pay page of your booking, such as GCash and Maya. Scan the QR code there, then send your proof of payment on our Facebook page.', 30),
  ('Is the deposit refundable?', 'Yes. The security deposit is returned after the equipment comes back and is checked. The down payment that confirms a booking is not refundable.', 40),
  ('Can I cancel my booking?', 'You can message us on Facebook to cancel. The down payment that confirms a booking is not refundable once the rental is booked.', 50),
  ('What time is pickup and return?', 'Pick a pickup time between 8:00 AM and 8:00 PM. The return is at the same time on your return date.', 60),
  ('What happens if I return late?', 'Late returns follow the rental agreement: ₱300 under 6 hours late, half a day of rent from 6 to 12 hours, then 1 day of rent for each day late.', 70),
  ('Can I extend my rental?', 'Message us on Facebook before your return time. Extra days depend on availability and are charged per day.', 80),
  ('Where are you located?', 'We are based in Davao City. Pickup, meetup, or delivery can be arranged after your booking is approved.', 90)
) as seed (question, answer, sort_order)
where not exists (select 1 from public.faqs);

comment on table public.faqs is
  'Frequently asked questions shown on the public FAQ page and used by the chat support. Hidden FAQs stay for admins only.';
