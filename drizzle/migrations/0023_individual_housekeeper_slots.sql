CREATE TABLE public.cleaner_appointment_slots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cleaner_id uuid NOT NULL REFERENCES public.profiles(id), slot_date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), CHECK (start_time < end_time));
GRANT SELECT ON public.cleaner_appointment_slots TO authenticated;
GRANT ALL ON public.cleaner_appointment_slots TO service_role;
ALTER TABLE public.cleaner_appointment_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_slots ON public.cleaner_appointment_slots FOR SELECT TO authenticated USING (cleaner_id=auth.uid() AND public.has_role(auth.uid(),'cleaner'));
ALTER TABLE public.bookings ADD COLUMN appointment_slot_id uuid REFERENCES public.cleaner_appointment_slots(id), ADD COLUMN appointment_start time, ADD COLUMN appointment_end time;
CREATE INDEX booking_slot_idx ON public.bookings(appointment_slot_id);
CREATE FUNCTION public.slot_window(_start time) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN _start<'12:00'::time THEN 'Morning (8am–12pm)' WHEN _start<'16:00'::time THEN 'Afternoon (12pm–4pm)' ELSE 'Evening (4pm–7pm)' END $$;
CREATE FUNCTION public.save_appointment_slot(_date date, _start time, _end time, _id uuid DEFAULT NULL, _active boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid; st public.cleaner_settings%ROWTYPE; h jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'cleaner') THEN RAISE EXCEPTION 'Housekeeper access is required.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 IF _id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cleaner_appointment_slots WHERE id=_id AND cleaner_id=auth.uid()) THEN RAISE EXCEPTION 'This is not your appointment slot.'; END IF;
 IF _id IS NOT NULL AND EXISTS(SELECT 1 FROM public.bookings WHERE appointment_slot_id=_id AND (status IN ('confirmed','completed') OR (status='pending_payment' AND created_at>now()-interval '30 minutes'))) THEN RAISE EXCEPTION 'This slot is reserved. Reschedule the appointment first.'; END IF;
 IF NOT _active AND _id IS NOT NULL THEN UPDATE public.cleaner_appointment_slots SET active=false WHERE id=_id; RETURN _id; END IF;
 IF _date IS NULL OR _start IS NULL OR _end IS NULL OR (_date+_start) AT TIME ZONE 'America/New_York' <= now() OR _start>=_end THEN RAISE EXCEPTION 'Choose a future date and an end time after the start.'; END IF;
 SELECT * INTO st FROM public.cleaner_settings WHERE user_id=auth.uid();
 h:=st.weekly_hours->(ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM _date)::integer+1];
 IF NOT FOUND OR NOT COALESCE((h->>'on')::boolean,false) OR _start<(h->>'start')::time OR _end>(h->>'end')::time OR _date=ANY(st.unavailable_dates) OR EXISTS(SELECT 1 FROM public.cleaner_date_blocks WHERE cleaner_id=auth.uid() AND blocked_date=_date) THEN RAISE EXCEPTION 'This slot must fit your saved working hours and days off.'; END IF;
 IF EXISTS(SELECT 1 FROM public.cleaner_appointment_slots WHERE cleaner_id=auth.uid() AND slot_date=_date AND active AND id IS DISTINCT FROM _id AND start_time<_end AND end_time>_start) THEN RAISE EXCEPTION 'This slot overlaps another appointment slot.'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE cleaner_id=auth.uid() AND preferred_date=_date AND status='confirmed' AND (CASE WHEN appointment_start IS NOT NULL THEN appointment_start<_end AND appointment_end>_start ELSE time_window=public.slot_window(_start) END)) THEN RAISE EXCEPTION 'This slot overlaps a booked appointment.'; END IF;
 IF _id IS NULL THEN INSERT INTO public.cleaner_appointment_slots(cleaner_id,slot_date,start_time,end_time) VALUES(auth.uid(),_date,_start,_end) RETURNING id INTO result;
 ELSE UPDATE public.cleaner_appointment_slots SET slot_date=_date,start_time=_start,end_time=_end,active=true WHERE id=_id RETURNING id INTO result; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_appointment_slot(date,time,time,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_appointment_slot(date,time,time,uuid,boolean) TO authenticated;
CREATE FUNCTION public.public_appointment_slots(_cleaner uuid) RETURNS TABLE(id uuid,slot_date date,start_time time,end_time time) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT s.id,s.slot_date,s.start_time,s.end_time FROM public.cleaner_appointment_slots s JOIN public.cleaner_settings st ON st.user_id=s.cleaner_id JOIN public.housekeeper_portfolios p ON p.user_id=s.cleaner_id AND p.published
 WHERE s.cleaner_id=_cleaner AND public.has_role(s.cleaner_id,'cleaner') AND s.active AND st.accepting_jobs AND (s.slot_date+s.start_time) AT TIME ZONE 'America/New_York'>now() AND NOT s.slot_date=ANY(st.unavailable_dates)
 AND COALESCE((st.weekly_hours->(ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM s.slot_date)::integer+1]->>'on')::boolean,false)
 AND s.start_time >= (st.weekly_hours->(ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM s.slot_date)::integer+1]->>'start')::time AND s.end_time <= (st.weekly_hours->(ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM s.slot_date)::integer+1]->>'end')::time
 AND NOT EXISTS(SELECT 1 FROM public.cleaner_date_blocks WHERE cleaner_id=s.cleaner_id AND blocked_date=s.slot_date)
 AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.preferred_date=s.slot_date AND (b.cleaner_id=s.cleaner_id OR b.requested_cleaner_id=s.cleaner_id) AND (b.status='confirmed' OR (b.status='pending_payment' AND b.created_at>now()-interval '30 minutes')) AND CASE WHEN b.appointment_start IS NOT NULL THEN b.appointment_start<s.end_time AND b.appointment_end>s.start_time ELSE b.time_window=public.slot_window(s.start_time) END)
 ORDER BY s.slot_date,s.start_time LIMIT 200 $$;
GRANT EXECUTE ON FUNCTION public.public_appointment_slots(uuid) TO anon,authenticated,service_role;
CREATE FUNCTION public.validate_appointment_slot_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.cleaner_appointment_slots%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='confirmed' AND (NEW.preferred_date IS DISTINCT FROM OLD.preferred_date OR NEW.time_window IS DISTINCT FROM OLD.time_window OR NEW.cleaner_id IS DISTINCT FROM OLD.cleaner_id) THEN NEW.appointment_slot_id:=NULL; NEW.appointment_start:=NULL; NEW.appointment_end:=NULL; RETURN NEW; END IF;
 IF NEW.appointment_slot_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO s FROM public.cleaner_appointment_slots WHERE id=NEW.appointment_slot_id;
 IF NOT FOUND OR NEW.requested_cleaner_id IS DISTINCT FROM s.cleaner_id THEN RAISE EXCEPTION 'Choose a slot from your selected housekeeper.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(s.cleaner_id::text,0));
 IF NEW.status NOT IN ('pending_payment','confirmed') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status='confirmed' THEN NEW.appointment_start:=OLD.appointment_start; NEW.appointment_end:=OLD.appointment_end; RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.public_appointment_slots(s.cleaner_id) a WHERE a.id=s.id) THEN
  IF NOT (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.bookings WHERE id=NEW.id AND appointment_slot_id=s.id AND status='pending_payment' AND created_at>now()-interval '30 minutes')) THEN RAISE EXCEPTION 'This slot is no longer available. Choose another time.'; END IF;
 END IF;
 IF NOT s.active OR NOT public.has_role(s.cleaner_id,'cleaner') OR NOT EXISTS(SELECT 1 FROM public.housekeeper_portfolios WHERE user_id=s.cleaner_id AND published) OR NOT EXISTS(SELECT 1 FROM public.cleaner_settings WHERE user_id=s.cleaner_id AND accepting_jobs AND NOT s.slot_date=ANY(unavailable_dates)) OR EXISTS(SELECT 1 FROM public.cleaner_date_blocks WHERE cleaner_id=s.cleaner_id AND blocked_date=s.slot_date) THEN RAISE EXCEPTION 'This housekeeper is unavailable.'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings b WHERE b.id<>NEW.id AND b.preferred_date=s.slot_date AND (b.cleaner_id=s.cleaner_id OR b.requested_cleaner_id=s.cleaner_id) AND (b.status='confirmed' OR (b.status='pending_payment' AND b.created_at>now()-interval '30 minutes')) AND CASE WHEN b.appointment_start IS NOT NULL THEN b.appointment_start<s.end_time AND b.appointment_end>s.start_time ELSE b.time_window=public.slot_window(s.start_time) END) THEN RAISE EXCEPTION 'This appointment slot is already reserved.'; END IF;
 NEW.preferred_date:=s.slot_date; NEW.time_window:=public.slot_window(s.start_time); NEW.appointment_start:=s.start_time; NEW.appointment_end:=s.end_time;
 IF NEW.status='confirmed' THEN NEW.cleaner_id:=s.cleaner_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aaa_validate_appointment_slot BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_slot_booking();
DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.validate_direct_housekeeper_booking()'::regprocedure) INTO definition; definition:=replace(definition,'BEGIN','BEGIN'||chr(10)||' IF NEW.appointment_slot_id IS NOT NULL THEN RETURN NEW; END IF;'); EXECUTE definition; END $$;