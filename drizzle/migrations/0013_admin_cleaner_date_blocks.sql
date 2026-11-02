CREATE TABLE public.cleaner_date_blocks (
 cleaner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 blocked_date date NOT NULL,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(cleaner_id,blocked_date)
);
GRANT SELECT ON public.cleaner_date_blocks TO authenticated;
GRANT ALL ON public.cleaner_date_blocks TO service_role;
ALTER TABLE public.cleaner_date_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and cleaner read blocks" ON public.cleaner_date_blocks FOR SELECT TO authenticated USING (cleaner_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.set_cleaner_date_block(_cleaner_id uuid,_date date,_blocked boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can block dates.'; END IF;
 IF _date IS NULL OR _blocked IS NULL OR NOT public.has_role(_cleaner_id,'cleaner') THEN RAISE EXCEPTION 'Choose a cleaner and date.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_cleaner_id::text,0));
 IF _blocked THEN
  IF _date < (now() AT TIME ZONE 'America/New_York')::date THEN RAISE EXCEPTION 'Choose today or a future date.'; END IF;
  IF EXISTS(SELECT 1 FROM public.bookings WHERE cleaner_id=_cleaner_id AND preferred_date=_date AND status='confirmed') THEN RAISE EXCEPTION 'Reschedule booked visits before blocking this date.'; END IF;
  INSERT INTO public.cleaner_date_blocks(cleaner_id,blocked_date,created_by) VALUES(_cleaner_id,_date,auth.uid()) ON CONFLICT DO NOTHING;
 ELSE
  DELETE FROM public.cleaner_date_blocks WHERE cleaner_id=_cleaner_id AND blocked_date=_date;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_cleaner_date_block(uuid,date,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_cleaner_date_block(uuid,date,boolean) TO authenticated;
CREATE FUNCTION public.enforce_cleaner_date_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.cleaner_id IS NOT NULL AND NEW.status='confirmed' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.cleaner_id::text,0));
  IF EXISTS(SELECT 1 FROM public.cleaner_date_blocks WHERE cleaner_id=NEW.cleaner_id AND blocked_date=NEW.preferred_date) THEN RAISE EXCEPTION 'This cleaner date is blocked by the admin.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enforce_cleaner_date_block BEFORE INSERT OR UPDATE OF cleaner_id,preferred_date,status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.enforce_cleaner_date_block();