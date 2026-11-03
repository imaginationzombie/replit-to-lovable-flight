DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.schedule_booking(uuid,date,text,uuid,date,text,uuid)'::regprocedure) INTO definition;
 definition := replace(definition, 'b.cleaner_id=auth.uid()', 'b.cleaner_id IS NOT DISTINCT FROM auth.uid()');
 definition := replace(definition, 'b.created_by_staff=auth.uid()', 'b.created_by_staff IS NOT DISTINCT FROM auth.uid()');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.reschedule_booking(uuid,date,text,jsonb,jsonb)'::regprocedure) INTO definition;
 definition := replace(definition, 'b.cleaner_id=auth.uid()', 'b.cleaner_id IS NOT DISTINCT FROM auth.uid()');
 definition := replace(definition, 'b.created_by_staff=auth.uid()', 'b.created_by_staff IS NOT DISTINCT FROM auth.uid()');
 EXECUTE definition;
END $$;