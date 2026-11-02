ALTER TABLE public.bookings
  ADD COLUMN paypal_vault_id text,
  ADD COLUMN parent_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN visit_number integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX bookings_one_next_visit ON public.bookings(parent_booking_id) WHERE parent_booking_id IS NOT NULL;