CREATE TABLE public.hiring_details (
 application_id uuid PRIMARY KEY REFERENCES public.hiring_applications(id) ON DELETE CASCADE,
 start_date date NOT NULL,
 weekly_hours numeric(5,2) NOT NULL CHECK (weekly_hours > 0 AND weekly_hours <= 168),
 hourly_pay_cents integer NOT NULL CHECK (hourly_pay_cents > 0 AND hourly_pay_cents <= 1000000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hiring_details TO authenticated;
GRANT ALL ON public.hiring_details TO service_role;
ALTER TABLE public.hiring_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and application owners read hiring details" ON public.hiring_details FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.hiring_applications a WHERE a.id=application_id AND a.user_id=auth.uid()));
CREATE FUNCTION public.save_hiring_details(_application_id uuid, _start_date date, _weekly_hours numeric, _hourly_pay_cents integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE candidate_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT status INTO candidate_status FROM public.hiring_applications WHERE id=_application_id FOR UPDATE;
 IF candidate_status IS DISTINCT FROM 'hired' THEN RAISE EXCEPTION 'Approve the candidate before setting hiring details'; END IF;
 IF _start_date IS NULL OR _weekly_hours IS NULL OR _weekly_hours <= 0 OR _weekly_hours > 168 OR _weekly_hours <> round(_weekly_hours,2) OR _hourly_pay_cents IS NULL OR _hourly_pay_cents <= 0 OR _hourly_pay_cents > 1000000 THEN RAISE EXCEPTION 'Enter a start date, valid weekly hours and hourly pay'; END IF;
 INSERT INTO public.hiring_details(application_id,start_date,weekly_hours,hourly_pay_cents) VALUES (_application_id,_start_date,_weekly_hours,_hourly_pay_cents) ON CONFLICT(application_id) DO UPDATE SET start_date=EXCLUDED.start_date,weekly_hours=EXCLUDED.weekly_hours,hourly_pay_cents=EXCLUDED.hourly_pay_cents,updated_at=now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_hiring_details(uuid,date,numeric,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_hiring_details(uuid,date,numeric,integer) TO authenticated;
COMMENT ON TABLE public.hiring_details IS 'Private admin-set onboarding terms; does not change cleaner settings or frozen timesheet wages.';