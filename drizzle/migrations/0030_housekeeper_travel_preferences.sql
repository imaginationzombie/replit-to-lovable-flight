ALTER TABLE public.cleaner_settings ADD COLUMN selected_service_areas text[], ADD COLUMN travel_base_area text, ADD COLUMN travel_radius_miles numeric;
ALTER TABLE public.cleaner_settings ADD CONSTRAINT cleaner_travel_radius_valid CHECK (travel_radius_miles IS NULL OR (travel_radius_miles >= 0 AND travel_radius_miles <= 500)), ADD CONSTRAINT cleaner_travel_base_required CHECK (travel_radius_miles IS NULL OR travel_base_area IS NOT NULL), ADD CONSTRAINT cleaner_selected_areas_valid CHECK (selected_service_areas IS NULL OR selected_service_areas <@ ARRAY['DuBois & Sandy Twp','Punxsutawney','Reynoldsville','Sykesville','Falls Creek / Brockway','Lewistown, PA']::text[]), ADD CONSTRAINT cleaner_base_area_valid CHECK (travel_base_area IS NULL OR travel_base_area = ANY(ARRAY['DuBois & Sandy Twp','Punxsutawney','Reynoldsville','Sykesville','Falls Creek / Brockway','Lewistown, PA']));
CREATE FUNCTION public.service_area_distance_miles(_from text, _to text) RETURNS double precision LANGUAGE sql IMMUTABLE SET search_path=public AS $$
WITH points(area,lat,lng) AS (VALUES ('DuBois & Sandy Twp',41.1192,-78.7600),('Punxsutawney',40.9437,-78.9709),('Reynoldsville',41.0970,-78.8886),('Sykesville',41.0503,-78.8223),('Falls Creek / Brockway',41.1451,-78.8045),('Falls Creek / Brockway',41.2492,-78.7995),('Lewistown, PA',40.5992,-77.5714))
SELECT max(3958.7613 * 2 * asin(least(1.0,sqrt(power(sin(radians(b.lat-a.lat)/2),2)+cos(radians(a.lat))*cos(radians(b.lat))*power(sin(radians(b.lng-a.lng)/2),2))))) FROM points a CROSS JOIN points b WHERE a.area=_from AND b.area=_to AND _from<>_to
$$;
CREATE FUNCTION public.cleaner_serves_area(_cleaner uuid, _area text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT COALESCE((SELECT (s.selected_service_areas IS NULL OR _area=ANY(s.selected_service_areas)) AND (s.travel_radius_miles IS NULL OR _area=s.travel_base_area OR COALESCE(public.service_area_distance_miles(s.travel_base_area,_area)<=s.travel_radius_miles,false)) FROM public.cleaner_settings s WHERE s.user_id=_cleaner),true)
$$;
REVOKE ALL ON FUNCTION public.cleaner_serves_area(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_serves_area(uuid,text) TO service_role;
CREATE FUNCTION public.available_cleaners_for_area(_area text) RETURNS TABLE(id uuid,display_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT c.id,c.display_name FROM public.available_slot_cleaners() c WHERE public.cleaner_serves_area(c.id,_area) $$;
REVOKE ALL ON FUNCTION public.available_cleaners_for_area(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.available_cleaners_for_area(text) TO anon,authenticated,service_role;
CREATE FUNCTION public.enforce_cleaner_service_area() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NEW.status NOT IN ('pending_payment','confirmed') THEN RETURN NEW; END IF;
IF TG_OP='UPDATE' AND NEW.cleaner_id IS NOT DISTINCT FROM OLD.cleaner_id AND NEW.requested_cleaner_id IS NOT DISTINCT FROM OLD.requested_cleaner_id AND NEW.service_area IS NOT DISTINCT FROM OLD.service_area AND (OLD.status='confirmed' OR NEW.status IS NOT DISTINCT FROM OLD.status) THEN RETURN NEW; END IF;
IF NEW.cleaner_id IS NOT NULL AND NOT public.cleaner_serves_area(NEW.cleaner_id,NEW.service_area) THEN RAISE EXCEPTION 'This location is outside the housekeeper''s selected areas or travel distance.'; END IF;
IF NEW.requested_cleaner_id IS NOT NULL AND NOT public.cleaner_serves_area(NEW.requested_cleaner_id,NEW.service_area) THEN RAISE EXCEPTION 'Choose a housekeeper who serves this location.'; END IF;
RETURN NEW;
END $$;
CREATE TRIGGER zz_enforce_cleaner_service_area BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.enforce_cleaner_service_area();
CREATE OR REPLACE FUNCTION public.waiting_cleanings() RETURNS TABLE(id uuid,service text,service_area text,preferred_date date,time_window text,bedrooms integer,bathrooms integer,add_ons text[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT b.id,b.service,b.service_area,b.preferred_date,b.time_window,b.bedrooms,b.bathrooms,b.add_ons FROM public.bookings b WHERE public.has_role(auth.uid(),'cleaner') AND b.status='confirmed' AND b.cleaner_id IS NULL AND b.preferred_date >= (now() AT TIME ZONE 'America/New_York')::date AND public.cleaner_serves_area(auth.uid(),b.service_area) ORDER BY b.preferred_date,b.time_window $$;