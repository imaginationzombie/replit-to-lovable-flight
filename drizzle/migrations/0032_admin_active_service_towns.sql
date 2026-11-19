CREATE TABLE public.service_towns (name text PRIMARY KEY, active boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0);
GRANT SELECT ON public.service_towns TO anon, authenticated;
GRANT UPDATE ON public.service_towns TO authenticated;
GRANT ALL ON public.service_towns TO service_role;
ALTER TABLE public.service_towns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Town settings are public" ON public.service_towns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Only admins update towns" ON public.service_towns FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.service_town_active(_area text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE((SELECT active FROM public.service_towns WHERE name=_area),false) $$;
REVOKE ALL ON FUNCTION public.service_town_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_town_active(text) TO anon,authenticated,service_role;
CREATE FUNCTION public.guard_active_service_town() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF TG_OP='UPDATE' THEN
 IF NEW.service_area IS NOT DISTINCT FROM OLD.service_area THEN RETURN NEW; END IF;
END IF;
IF NEW.status IN ('pending_payment','confirmed') AND NOT public.service_town_active(NEW.service_area) THEN RAISE EXCEPTION 'This town is not currently accepting new appointments. Choose an active service town.'; END IF;
RETURN NEW;
END $$;
CREATE TRIGGER aa_guard_active_service_town BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_active_service_town();
CREATE OR REPLACE FUNCTION public.available_cleaners_for_area(_area text) RETURNS TABLE(id uuid,display_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT c.id,c.display_name FROM public.available_slot_cleaners() c WHERE public.service_town_active(_area) AND public.cleaner_serves_area(c.id,_area) $$;