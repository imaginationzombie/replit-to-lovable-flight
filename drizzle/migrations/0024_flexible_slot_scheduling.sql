DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.save_appointment_slot(date,time,time,uuid,boolean)'::regprocedure) INTO d;
 d:=replace(d, 'IF NOT FOUND OR NOT COALESCE((h->>''on'')::boolean,false) OR _start<(h->>''start'')::time OR _end>(h->>''end'')::time OR _date=ANY(st.unavailable_dates) OR EXISTS', 'IF EXISTS');
 d:=replace(d, 'This slot must fit your saved working hours and days off.', 'This date is blocked by the admin.'); EXECUTE d;
 SELECT pg_get_functiondef('public.public_appointment_slots(uuid)'::regprocedure) INTO d;
 d:=replace(d,'AND st.accepting_jobs AND','AND');
 d:=replace(d,'AND NOT s.slot_date=ANY(st.unavailable_dates)','');
 d:=regexp_replace(d, 'AND COALESCE\(\(st.weekly_hours[\s\S]*?AND NOT EXISTS\(SELECT 1 FROM public.cleaner_date_blocks', 'AND NOT EXISTS(SELECT 1 FROM public.cleaner_date_blocks'); EXECUTE d;
 SELECT pg_get_functiondef('public.validate_appointment_slot_booking()'::regprocedure) INTO d;
 d:=replace(d,'AND accepting_jobs AND NOT s.slot_date=ANY(unavailable_dates)','');
 d:=replace(d,'IF NEW.appointment_slot_id IS NULL THEN RETURN NEW; END IF;', 'IF NEW.appointment_slot_id IS NULL THEN IF TG_OP=''INSERT'' AND NEW.created_by_staff IS NULL AND NEW.parent_booking_id IS NULL THEN RAISE EXCEPTION ''Choose an available appointment slot.''; END IF; RETURN NEW; END IF;');
 EXECUTE d;
END $$;
CREATE FUNCTION public.available_slot_cleaners() RETURNS TABLE(id uuid,display_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT p.user_id,p.display_name FROM public.housekeeper_portfolios p WHERE p.published AND EXISTS(SELECT 1 FROM public.public_appointment_slots(p.user_id)) ORDER BY p.display_name $$;
GRANT EXECUTE ON FUNCTION public.available_slot_cleaners() TO anon,authenticated,service_role;
CREATE FUNCTION public.guard_slot_schedule_conflicts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE who uuid; a time; z time;
BEGIN
 IF NEW.status NOT IN ('pending_payment','confirmed') THEN RETURN NEW; END IF;
 who:=COALESCE(NEW.cleaner_id,NEW.requested_cleaner_id);
 IF who IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(who::text,0));
 a:=COALESCE(NEW.appointment_start, CASE NEW.time_window WHEN 'Morning (8am–12pm)' THEN '08:00'::time WHEN 'Afternoon (12pm–4pm)' THEN '12:00'::time ELSE '16:00'::time END);
 z:=COALESCE(NEW.appointment_end, CASE NEW.time_window WHEN 'Morning (8am–12pm)' THEN '12:00'::time WHEN 'Afternoon (12pm–4pm)' THEN '16:00'::time ELSE '19:00'::time END);
 IF EXISTS(SELECT 1 FROM public.bookings b WHERE b.id<>NEW.id AND COALESCE(b.cleaner_id,b.requested_cleaner_id)=who AND b.preferred_date=NEW.preferred_date AND (b.status='confirmed' OR (b.status='pending_payment' AND b.created_at>now()-interval '30 minutes')) AND COALESCE(b.appointment_start,CASE b.time_window WHEN 'Morning (8am–12pm)' THEN '08:00'::time WHEN 'Afternoon (12pm–4pm)' THEN '12:00'::time ELSE '16:00'::time END)<z AND COALESCE(b.appointment_end,CASE b.time_window WHEN 'Morning (8am–12pm)' THEN '12:00'::time WHEN 'Afternoon (12pm–4pm)' THEN '16:00'::time ELSE '19:00'::time END)>a) THEN RAISE EXCEPTION 'This appointment overlaps a reserved visit.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_guard_slot_schedule BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_slot_schedule_conflicts();