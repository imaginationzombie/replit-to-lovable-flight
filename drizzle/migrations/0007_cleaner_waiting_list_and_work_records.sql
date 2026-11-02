CREATE TABLE public.appointment_work (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES public.bookings(id), cleaner_id uuid NOT NULL REFERENCES public.profiles(id), minutes integer NOT NULL DEFAULT 0 CHECK (minutes >= 0 AND minutes <= 1440), notes text NOT NULL DEFAULT '', completed_tasks text[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','paid')), rate_cents integer NOT NULL DEFAULT 0, amount_cents integer NOT NULL DEFAULT 0, submitted_at timestamptz, paid_at timestamptz, payment_reference text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(booking_id,cleaner_id)
);
GRANT SELECT ON public.appointment_work TO authenticated;
GRANT ALL ON public.appointment_work TO service_role;
ALTER TABLE public.appointment_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own cleaner work or admin read" ON public.appointment_work FOR SELECT TO authenticated USING ((cleaner_id = auth.uid() AND public.has_role(auth.uid(),'cleaner')) OR public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.waiting_cleanings() RETURNS TABLE(id uuid, service text, service_area text, preferred_date date, time_window text, bedrooms integer, bathrooms integer, add_ons text[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT b.id,b.service,b.service_area,b.preferred_date,b.time_window,b.bedrooms,b.bathrooms,b.add_ons FROM public.bookings b WHERE public.has_role(auth.uid(),'cleaner') AND b.status='confirmed' AND b.cleaner_id IS NULL AND b.preferred_date >= (now() AT TIME ZONE 'America/New_York')::date ORDER BY b.preferred_date,b.time_window $$;
REVOKE ALL ON FUNCTION public.waiting_cleanings() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.waiting_cleanings() TO authenticated;
CREATE FUNCTION public.claim_cleaning(_booking_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings%ROWTYPE; st public.cleaner_settings%ROWTYPE; h jsonb; day_key text; starts time; ends time;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'cleaner') THEN RAISE EXCEPTION 'Cleaner access required.'; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;
 IF NOT FOUND OR b.status <> 'confirmed' OR b.cleaner_id IS NOT NULL THEN RAISE EXCEPTION 'This visit is no longer available.'; END IF;
 IF b.preferred_date < (now() AT TIME ZONE 'America/New_York')::date THEN RAISE EXCEPTION 'This appointment date has passed.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 SELECT * INTO st FROM public.cleaner_settings WHERE user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Set your appointment availability first.'; END IF;
 IF NOT st.accepting_jobs OR b.preferred_date=ANY(st.unavailable_dates) THEN RAISE EXCEPTION 'You are not available for this appointment.'; END IF;
 day_key := (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM b.preferred_date)::integer+1];
 h:=st.weekly_hours->day_key;
 IF h IS NULL OR NOT COALESCE((h->>'on')::boolean,false) THEN RAISE EXCEPTION 'This day is outside your available hours.'; END IF;
 starts:=CASE b.time_window WHEN 'Morning (8am–12pm)' THEN '08:00'::time WHEN 'Afternoon (12pm–4pm)' THEN '12:00'::time WHEN 'Evening (4pm–7pm)' THEN '16:00'::time ELSE NULL END;
 ends:=CASE b.time_window WHEN 'Morning (8am–12pm)' THEN '12:00'::time WHEN 'Afternoon (12pm–4pm)' THEN '16:00'::time WHEN 'Evening (4pm–7pm)' THEN '19:00'::time ELSE NULL END;
 IF starts IS NULL OR (h->>'start')::time > starts OR (h->>'end')::time < ends THEN RAISE EXCEPTION 'Your available hours must cover the appointment window.'; END IF;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE cleaner_id=auth.uid() AND preferred_date=b.preferred_date AND time_window=b.time_window AND status='confirmed') THEN RAISE EXCEPTION 'You already have an appointment in this window.'; END IF;
 UPDATE public.bookings SET cleaner_id=auth.uid() WHERE id=b.id;
END $$;
REVOKE ALL ON FUNCTION public.claim_cleaning(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_cleaning(uuid) TO authenticated;
CREATE FUNCTION public.save_appointment_work(_booking_id uuid,_minutes integer,_notes text,_tasks text[],_submit boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings%ROWTYPE; w public.appointment_work%ROWTYPE; rate integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'cleaner') THEN RAISE EXCEPTION 'Cleaner access required.'; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;
 IF NOT FOUND OR b.cleaner_id IS DISTINCT FROM auth.uid() OR b.status NOT IN ('confirmed','completed') THEN RAISE EXCEPTION 'This is not your active appointment.'; END IF;
 IF _minutes IS NULL OR _minutes<0 OR _minutes>1440 OR length(COALESCE(_notes,''))>2000 OR cardinality(_tasks)>100 THEN RAISE EXCEPTION 'Enter valid hours and notes.'; END IF;
 SELECT * INTO w FROM public.appointment_work WHERE booking_id=b.id AND cleaner_id=auth.uid() FOR UPDATE;
 IF FOUND AND w.status<>'draft' THEN RAISE EXCEPTION 'Submitted timesheets cannot be edited.'; END IF;
 SELECT hourly_rate_cents INTO rate FROM public.cleaner_settings WHERE user_id=auth.uid();
 IF _submit AND (_minutes=0 OR COALESCE(rate,0)<=0) THEN RAISE EXCEPTION 'Log hours and set an hourly rate before submitting.'; END IF;
 IF _submit AND b.preferred_date>(now() AT TIME ZONE 'America/New_York')::date THEN RAISE EXCEPTION 'Timesheets can only be submitted on or after the appointment date.'; END IF;
 INSERT INTO public.appointment_work(booking_id,cleaner_id,minutes,notes,completed_tasks,status,rate_cents,amount_cents,submitted_at)
 VALUES(b.id,auth.uid(),_minutes,COALESCE(_notes,''),COALESCE(_tasks,'{}'),CASE WHEN _submit THEN 'submitted' ELSE 'draft' END,COALESCE(rate,0),round(_minutes::numeric*COALESCE(rate,0)/60),CASE WHEN _submit THEN now() ELSE NULL END)
 ON CONFLICT(booking_id,cleaner_id) DO UPDATE SET minutes=excluded.minutes,notes=excluded.notes,completed_tasks=excluded.completed_tasks,status=excluded.status,rate_cents=excluded.rate_cents,amount_cents=excluded.amount_cents,submitted_at=excluded.submitted_at,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.save_appointment_work(uuid,integer,text,text[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_appointment_work(uuid,integer,text,text[],boolean) TO authenticated;
CREATE FUNCTION public.review_timesheet(_id uuid,_action text,_reference text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.appointment_work%ROWTYPE;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required.'; END IF;
 SELECT * INTO w FROM public.appointment_work WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Timesheet not found.'; END IF;
 IF _action='approve' AND w.status='submitted' THEN UPDATE public.appointment_work SET status='approved',updated_at=now() WHERE id=_id;
 ELSIF _action='return' AND w.status='submitted' THEN UPDATE public.appointment_work SET status='draft',submitted_at=NULL,updated_at=now() WHERE id=_id;
 ELSIF _action='paid' AND w.status='approved' AND length(trim(_reference)) BETWEEN 1 AND 200 THEN UPDATE public.appointment_work SET status='paid',paid_at=now(),payment_reference=trim(_reference),updated_at=now() WHERE id=_id;
 ELSE RAISE EXCEPTION 'Invalid timesheet transition or missing payment reference.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_timesheet(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_timesheet(uuid,text,text) TO authenticated;