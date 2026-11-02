CREATE OR REPLACE FUNCTION public.reschedule_booking(_booking_id uuid, _date date, _time_window text, _assignment jsonb, _expected jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 PERFORM public.schedule_booking(_booking_id, _date, _time_window, (_assignment->>'cleaner_id')::uuid, (_expected->>'date')::date, _expected->>'time_window', (_expected->>'cleaner_id')::uuid);
END;
$$;
REVOKE ALL ON FUNCTION public.reschedule_booking(uuid,date,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(uuid,date,text,jsonb,jsonb) TO authenticated;