-- Only administrators can delete bookings. Customers keep cancel; the server cleans up
-- a draft that failed halfway through creation with the service-role key.

drop policy if exists rental_requests_delete_own_draft on public.rental_requests;
