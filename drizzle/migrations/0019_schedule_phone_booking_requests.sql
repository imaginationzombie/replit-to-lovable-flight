CREATE OR REPLACE FUNCTION public.schedule_booking(_booking_id uuid, _date date, _time_window text, _cleaner_id uuid, _expected_date date, _expected_time_window text, _expected_cleaner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE; admin_access boolean; phone_request boolean; st public.cleaner_settings%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to schedule bookings.'; END IF;
 admin_access := public.has_role(auth.uid(), 'admin');
 SELECT * INTO b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;
 phone_request := b.status='pending_payment' AND b.created_by_staff IS NOT NULL;
 IF NOT admin_access AND NOT (public.has_role(auth.uid(), 'cleaner') AND ((b.status='confirmed' AND b.cleaner_id=auth.uid()) OR (phone_request AND b.created_by_staff=auth.uid()))) THEN RAISE EXCEPTION 'You can only schedule your assigned jobs or your own phone requests.'; END IF;
 IF b.status <> 'confirmed' AND NOT phone_request THEN RAISE EXCEPTION 'Only confirmed visits or phone requests can be rescheduled.'; END IF;
 IF phone_request AND _cleaner_id IS DISTINCT FROM b.cleaner_id THEN RAISE EXCEPTION 'Confirm customer checkout before assigning this phone request.'; END IF;
 IF NOT admin_access AND _cleaner_id IS DISTINCT FROM b.cleaner_id THEN RAISE EXCEPTION 'Only admins can change the assigned cleaner.'; END IF;
 IF b.preferred_date IS DISTINCT FROM _expected_date OR b.time_window IS DISTINCT FROM _expected_time_window OR b.cleaner_id IS DISTINCT FROM _expected_cleaner_id THEN RAISE EXCEPTION 'This booking changed. Refresh and try again.'; END IF;
 IF _date IS NULL OR _date < (now() AT TIME ZONE 'America/New_York')::date THEN RAISE EXCEPTION 'Choose today or a future date.'; END IF;
 IF _time_window IS NULL OR _time_window NOT IN ('Morning (8am–12pm)', 'Afternoon (12pm–4pm)', 'Evening (4pm–7pm)') THEN RAISE EXCEPTION 'Choose a valid time window.'; END IF;
 IF _cleaner_id IS NOT NULL THEN
  IF NOT public.has_role(_cleaner_id, 'cleaner') THEN RAISE EXCEPTION 'Choose an active cleaner.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_cleaner_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.bookings WHERE id <> _booking_id AND cleaner_id = _cleaner_id AND preferred_date = _date AND time_window = _time_window AND status = 'confirmed') THEN RAISE EXCEPTION 'This cleaner already has a booking in that time window.'; END IF;
  IF EXISTS (SELECT 1 FROM public.cleaner_date_blocks WHERE cleaner_id=_cleaner_id AND blocked_date=_date) THEN RAISE EXCEPTION 'This cleaner date is blocked by the admin.'; END IF;
  SELECT * INTO st FROM public.cleaner_settings WHERE user_id = _cleaner_id;
  IF FOUND THEN
   IF _date = ANY(st.unavailable_dates) THEN RAISE EXCEPTION 'This cleaner has that day off.'; END IF;
   IF NOT st.accepting_jobs AND _cleaner_id IS DISTINCT FROM b.cleaner_id THEN RAISE EXCEPTION 'This cleaner is not accepting new jobs.'; END IF;
  END IF;
 END IF;
 UPDATE public.bookings SET preferred_date = _date, time_window = _time_window, cleaner_id = _cleaner_id WHERE id = _booking_id;
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_booking(uuid,date,text,uuid,date,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_booking(uuid,date,text,uuid,date,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.reschedule_booking(_booking_id uuid, _date date, _time_window text, _assignment jsonb, _expected jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to schedule bookings.'; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;
 IF NOT FOUND OR NOT (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'cleaner') AND ((b.status='confirmed' AND b.cleaner_id=auth.uid()) OR (b.status='pending_payment' AND b.created_by_staff=auth.uid())))) THEN RAISE EXCEPTION 'Booking not found or not allowed.'; END IF;
 IF _expected ? 'status' AND b.status IS DISTINCT FROM (_expected->>'status') THEN RAISE EXCEPTION 'This booking changed. Refresh and try again.'; END IF;
 PERFORM public.schedule_booking(_booking_id, _date, _time_window, (_assignment->>'cleaner_id')::uuid, (_expected->>'date')::date, _expected->>'time_window', (_expected->>'cleaner_id')::uuid);
END;
$$;
REVOKE ALL ON FUNCTION public.reschedule_booking(uuid,date,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(uuid,date,text,jsonb,jsonb) TO authenticated;