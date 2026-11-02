CREATE TABLE public.cleaner_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio text NOT NULL DEFAULT '',
  hourly_rate_cents integer NOT NULL DEFAULT 0 CHECK (hourly_rate_cents >= 0 AND hourly_rate_cents <= 100000),
  service_areas text NOT NULL DEFAULT '',
  accepting_jobs boolean NOT NULL DEFAULT true,
  weekly_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  unavailable_dates date[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cleaner_settings TO authenticated;
GRANT ALL ON public.cleaner_settings TO service_role;
ALTER TABLE public.cleaner_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cleaners read own settings" ON public.cleaner_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Cleaners insert own settings" ON public.cleaner_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'cleaner'));
CREATE POLICY "Cleaners update own settings" ON public.cleaner_settings FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'cleaner')) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read cleaner settings" ON public.cleaner_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update cleaner settings" ON public.cleaner_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));