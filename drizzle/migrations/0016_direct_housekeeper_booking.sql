ALTER TABLE public.bookings ADD COLUMN requested_cleaner_id uuid REFERENCES public.profiles(id);
CREATE FUNCTION public.validate_direct_housekeeper_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE st public.cleaner_settings%ROWTYPE; h jsonb; starts time; ends time; day_key text;
BEGIN
 IF NEW.requested_cleaner_id IS NULL OR NEW.status NOT IN ('pending_payment','confirmed') THEN RETURN NEW; END IF;
 IF NEW.status='confirmed' AND TG_OP='UPDATE' AND OLD.status='confirmed' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.requested_cleaner_id::text,0));
 IF NOT public.has_role(NEW.requested_cleaner_id,'cleaner') OR NOT EXISTS(SELECT 1 FROM public.housekeeper_portfolios WHERE user_id=NEW.requested_cleaner_id AND published) THEN RAISE EXCEPTION 'This housekeeper is not available for direct booking.'; END IF;
 IF NEW.preferred_date < (now() AT TIME ZONE 'America/New_York')::date THEN RAISE EXCEPTION 'Choose today or a future appointment date.'; END IF;
 SELECT * INTO st FROM public.cleaner_settings WHERE user_id=NEW.requested_cleaner_id;
 IF NOT FOUND OR NOT st.accepting_jobs OR NEW.preferred_date=ANY(st.unavailable_dates) OR EXISTS(SELECT 1 FROM public.cleaner_date_blocks WHERE cleaner_id=NEW.requested_cleaner_id AND blocked_date=NEW.preferred_date) THEN RAISE EXCEPTION 'This housekeeper is unavailable on that date. Choose another date.'; END IF;
 day_key:=(ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM NEW.preferred_date)::integer+1];
 h:=st.weekly_hours->day_key;
 starts:=CASE NEW.time_window WHEN 'Morning (8am–12pm)' THEN '08:00'::time WHEN 'Afternoon (12pm–4pm)' THEN '12:00'::time WHEN 'Evening (4pm–7pm)' THEN '16:00'::time ELSE NULL END;
 ends:=CASE NEW.time_window WHEN 'Morning (8am–12pm)' THEN '12:00'::time WHEN 'Afternoon (12pm–4pm)' THEN '16:00'::time WHEN 'Evening (4pm–7pm)' THEN '19:00'::time ELSE NULL END;
 IF h IS NULL OR NOT COALESCE((h->>'on')::boolean,false) OR starts IS NULL OR (h->>'start')::time>starts OR (h->>'end')::time<ends THEN RAISE EXCEPTION 'This housekeeper is unavailable during that arrival window. Choose another time.'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings b WHERE b.id<>NEW.id AND b.preferred_date=NEW.preferred_date AND b.time_window=NEW.time_window AND ((b.cleaner_id=NEW.requested_cleaner_id AND b.status='confirmed') OR (b.requested_cleaner_id=NEW.requested_cleaner_id AND b.status='pending_payment' AND b.created_at>now()-interval '30 minutes'))) THEN RAISE EXCEPTION 'That housekeeper already has a booking in this window. Choose another time.'; END IF;
 IF NEW.status='confirmed' THEN NEW.cleaner_id:=NEW.requested_cleaner_id; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_direct_housekeeper_booking() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER direct_housekeeper_booking BEFORE INSERT OR UPDATE OF status,requested_cleaner_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.validate_direct_housekeeper_booking();