CREATE TYPE public.app_role AS ENUM ('admin', 'cleaner', 'customer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- profiles
CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- prevent users changing their own email column directly
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.email := OLD.email;
  NEW.id := OLD.id;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

-- user_roles
CREATE POLICY "Own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins remove roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

-- new user -> profile + customer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- bookings ownership + assignment
ALTER TABLE public.bookings ADD COLUMN user_id uuid;
ALTER TABLE public.bookings ADD COLUMN cleaner_id uuid;
CREATE INDEX bookings_user_id_idx ON public.bookings(user_id);
CREATE INDEX bookings_cleaner_id_idx ON public.bookings(cleaner_id);
CREATE INDEX bookings_email_idx ON public.bookings(lower(email));
GRANT SELECT, UPDATE ON public.bookings TO authenticated;

CREATE POLICY "Customers read own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (lower(email) = lower(auth.jwt()->>'email') AND (auth.jwt()->>'email_verified')::boolean IS DISTINCT FROM false));
CREATE POLICY "Cleaners read assigned bookings" ON public.bookings FOR SELECT TO authenticated
  USING (cleaner_id = auth.uid() AND public.has_role(auth.uid(), 'cleaner'));
CREATE POLICY "Admins read bookings" ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- cleaners can mark their own jobs done (only status), via function
CREATE OR REPLACE FUNCTION public.cleaner_complete_booking(_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'cleaner') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.bookings SET status = 'completed'
  WHERE id = _booking_id AND cleaner_id = auth.uid() AND status = 'confirmed';
END $$;
REVOKE EXECUTE ON FUNCTION public.cleaner_complete_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleaner_complete_booking(uuid) TO authenticated;

-- admin directory of cleaners (names only)
CREATE OR REPLACE FUNCTION public.list_cleaners()
RETURNS TABLE (id uuid, full_name text, email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'cleaner'
  WHERE public.has_role(auth.uid(), 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.list_cleaners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_cleaners() TO authenticated;