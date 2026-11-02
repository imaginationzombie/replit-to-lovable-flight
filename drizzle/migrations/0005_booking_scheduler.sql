CREATE OR REPLACE FUNCTION public.schedule_booking(_booking_id uuid, _date date, _time_window text, _cleaner_id uuid, _expected_date date, _expected_time_window text, _expected_cleaner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE; admin_access boolean; st public.cleaner_settings%ROWTYPE; day_key text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to schedule bookings.'; END IF;
 admin_access := public.has_role(auth.uid(), 'admin');
 SELECT * INTO b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;
 IF NOT admin_access AND NOT (public.has_role(auth.uid(), 'cleaner') AND b.cleaner_id = auth.uid()) THEN RAISE EXCEPTION 'You can only schedule your assigned jobs.'; END IF;
 IF NOT admin_access AND _cleaner_id IS DISTINCT FROM b.cleaner_id THEN RAISE EXCEPTION 'Only admins can change the assigned cleaner.'; END IF;
 IF b.status <> 'confirmed' THEN RAISE EXCEPTION 'Only confirmed visits can be rescheduled.'; END IF;
 IF b.preferred_date IS DISTINCT FROM _expected_date OR b.time_window IS DISTINCT FROM _expected_time_window OR b.cleaner_id IS DISTINCT FROM _expected_cleaner_id THEN RAISE EXCEPTION 'This booking changed. Refresh and try again.'; END IF;
 IF _date IS NULL OR _date < (now() AT TIME ZONE 'America/New_York')::date THEN RAISE EXCEPTION 'Choose today or a future date.'; END IF;
 IF _time_window IS NULL OR _time_window NOT IN ('Morning (8am–12pm)', 'Afternoon (12pm–4pm)', 'Evening (4pm–7pm)') THEN RAISE EXCEPTION 'Choose a valid time window.'; END IF;
 IF _cleaner_id IS NOT NULL THEN
  IF NOT public.has_role(_cleaner_id, 'cleaner') THEN RAISE EXCEPTION 'Choose an active cleaner.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_cleaner_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.bookings WHERE id <> _booking_id AND cleaner_id = _cleaner_id AND preferred_date = _date AND time_window = _time_window AND status = 'confirmed') THEN RAISE EXCEPTION 'This cleaner already has a booking in that time window.'; END IF;
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