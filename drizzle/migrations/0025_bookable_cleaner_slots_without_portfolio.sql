DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.public_appointment_slots(uuid)'::regprocedure) INTO d;
 d:=replace(d,' JOIN public.cleaner_settings st ON st.user_id=s.cleaner_id JOIN public.housekeeper_portfolios p ON p.user_id=s.cleaner_id AND p.published',''); EXECUTE d;
 SELECT pg_get_functiondef('public.validate_appointment_slot_booking()'::regprocedure) INTO d;
 d:=replace(d,' OR NOT EXISTS(SELECT 1 FROM public.housekeeper_portfolios WHERE user_id=s.cleaner_id AND published) OR NOT EXISTS(SELECT 1 FROM public.cleaner_settings WHERE user_id=s.cleaner_id )',''); EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.available_slot_cleaners() RETURNS TABLE(id uuid,display_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT p.id,p.full_name FROM public.profiles p WHERE EXISTS(SELECT 1 FROM public.public_appointment_slots(p.id)) ORDER BY p.full_name $$;