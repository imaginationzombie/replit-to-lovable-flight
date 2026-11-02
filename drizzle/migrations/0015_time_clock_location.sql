CREATE TABLE public.time_clock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  clock_in_at timestamptz NOT NULL DEFAULT now(),
  clock_out_at timestamptz,
  in_lat double precision, in_lng double precision,
  out_lat double precision, out_lng double precision,
  last_lat double precision, last_lng double precision, last_accuracy double precision,
  last_seen_at timestamptz
);
CREATE UNIQUE INDEX time_clock_one_open ON public.time_clock_entries(user_id) WHERE clock_out_at IS NULL;
CREATE INDEX time_clock_booking ON public.time_clock_entries(booking_id);
CREATE TABLE public.location_pings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES public.time_clock_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat double precision NOT NULL, lng double precision NOT NULL, accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX location_pings_entry ON public.location_pings(entry_id, recorded_at);
GRANT SELECT ON public.time_clock_entries TO authenticated;
GRANT SELECT ON public.location_pings TO authenticated;
GRANT ALL ON public.time_clock_entries TO service_role;
GRANT ALL ON public.location_pings TO service_role;
ALTER TABLE public.time_clock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin read clock" ON public.time_clock_entries FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own or admin read pings" ON public.location_pings FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.check_coords(_lat double precision, _lng double precision) RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN IF _lat IS NULL OR _lng IS NULL OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN RAISE EXCEPTION 'A valid location is required.'; END IF; END $$;

CREATE FUNCTION public.clock_in(_booking uuid, _lat double precision, _lng double precision, _accuracy double precision) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid; _admin boolean := public.has_role(auth.uid(),'admin');
BEGIN
  IF NOT (_admin OR public.has_role(auth.uid(),'cleaner')) THEN RAISE EXCEPTION 'Only staff can clock in.'; END IF;
  PERFORM public.check_coords(_lat,_lng);
  IF _booking IS NULL AND NOT _admin THEN RAISE EXCEPTION 'Choose the appointment you are clocking in for.'; END IF;
  IF _booking IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bookings WHERE id=_booking AND status='confirmed' AND (cleaner_id=auth.uid() OR _admin)) THEN
    RAISE EXCEPTION 'You can only clock in to a confirmed appointment assigned to you.'; END IF;
  IF EXISTS (SELECT 1 FROM public.time_clock_entries WHERE user_id=auth.uid() AND clock_out_at IS NULL) THEN RAISE EXCEPTION 'You are already clocked in.'; END IF;
  INSERT INTO public.time_clock_entries(user_id,booking_id,in_lat,in_lng,last_lat,last_lng,last_accuracy,last_seen_at)
  VALUES (auth.uid(),_booking,_lat,_lng,_lat,_lng,_accuracy,now()) RETURNING id INTO _id;
  INSERT INTO public.location_pings(entry_id,user_id,lat,lng,accuracy) VALUES (_id,auth.uid(),_lat,_lng,_accuracy);
  RETURN _id;
END $$;

CREATE FUNCTION public.record_location(_lat double precision, _lng double precision, _accuracy double precision) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid;
BEGIN
  PERFORM public.check_coords(_lat,_lng);
  SELECT id INTO _id FROM public.time_clock_entries WHERE user_id=auth.uid() AND clock_out_at IS NULL;
  IF _id IS NULL THEN RAISE EXCEPTION 'You are not clocked in.'; END IF;
  UPDATE public.time_clock_entries SET last_lat=_lat,last_lng=_lng,last_accuracy=_accuracy,last_seen_at=now() WHERE id=_id;
  INSERT INTO public.location_pings(entry_id,user_id,lat,lng,accuracy) VALUES (_id,auth.uid(),_lat,_lng,_accuracy);
END $$;

CREATE FUNCTION public.clock_out(_lat double precision, _lng double precision, _accuracy double precision) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid;
BEGIN
  PERFORM public.check_coords(_lat,_lng);
  SELECT id INTO _id FROM public.time_clock_entries WHERE user_id=auth.uid() AND clock_out_at IS NULL;
  IF _id IS NULL THEN RAISE EXCEPTION 'You are not clocked in.'; END IF;
  UPDATE public.time_clock_entries SET clock_out_at=now(),out_lat=_lat,out_lng=_lng,last_lat=_lat,last_lng=_lng,last_accuracy=_accuracy,last_seen_at=now() WHERE id=_id;
  INSERT INTO public.location_pings(entry_id,user_id,lat,lng,accuracy) VALUES (_id,auth.uid(),_lat,_lng,_accuracy);
END $$;

CREATE FUNCTION public.booking_cleaner_location(_booking uuid) RETURNS TABLE(lat double precision, lng double precision, accuracy double precision, seen_at timestamptz, clocked_in_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT e.last_lat, e.last_lng, e.last_accuracy, e.last_seen_at, e.clock_in_at
  FROM public.time_clock_entries e JOIN public.bookings b ON b.id=e.booking_id AND b.cleaner_id=e.user_id
  WHERE e.booking_id=_booking AND e.clock_out_at IS NULL AND e.last_seen_at > now() - interval '30 minutes'
    AND public.owns_customer_booking(_booking)
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.clock_in(uuid,double precision,double precision,double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_location(double precision,double precision,double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clock_out(double precision,double precision,double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booking_cleaner_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clock_in(uuid,double precision,double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_location(double precision,double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_out(double precision,double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.booking_cleaner_location(uuid) TO authenticated;