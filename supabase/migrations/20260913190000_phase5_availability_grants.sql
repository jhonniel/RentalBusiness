-- Phase 5: public availability checks call the overlap function through the anon client.
-- The function is security definer so it can count occupying rentals without exposing rows.

revoke all on function public.product_booked_quantity(bigint, date, date) from public;
grant execute on function public.product_booked_quantity(bigint, date, date) to anon, authenticated;
