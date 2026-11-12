CREATE TABLE public.gift_certificates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), buyer_id uuid NOT NULL REFERENCES public.profiles(id), buyer_email text NOT NULL,
 recipient_name text NOT NULL DEFAULT '', message text NOT NULL DEFAULT '', amount_cents integer NOT NULL CHECK(amount_cents IN (5000,10000,15000)), balance_cents integer NOT NULL DEFAULT 0 CHECK(balance_cents>=0),
 code uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid')), environment text NOT NULL CHECK(environment IN ('sandbox','live')),
 paypal_order_id text UNIQUE, paypal_capture_id text UNIQUE, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK(balance_cents<=amount_cents)
);
GRANT SELECT ON public.gift_certificates TO authenticated;
GRANT ALL ON public.gift_certificates TO service_role;
ALTER TABLE public.gift_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers read own gift certificates" ON public.gift_certificates FOR SELECT TO authenticated USING(buyer_id=auth.uid());
ALTER TABLE public.bookings ADD COLUMN gift_credit_cents integer NOT NULL DEFAULT 0 CHECK(gift_credit_cents>=0), ADD COLUMN payment_checkout_started boolean NOT NULL DEFAULT false;
CREATE TABLE public.gift_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), certificate_id uuid NOT NULL REFERENCES public.gift_certificates(id), booking_id uuid NOT NULL REFERENCES public.bookings(id), amount_cents integer NOT NULL CHECK(amount_cents>0), released_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gift_redemptions TO service_role;
ALTER TABLE public.gift_redemptions ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.redeem_gift_certificate(_booking uuid,_token uuid,_code uuid,_environment text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings%ROWTYPE; g public.gift_certificates%ROWTYPE; applied integer;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=_booking AND access_token=_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
 IF b.status NOT IN ('confirmed','completed') OR b.paid_at IS NOT NULL OR b.paypal_capture_id IS NOT NULL OR b.payment_checkout_started THEN RAISE EXCEPTION 'Gift credit cannot be added after payment has started or to an inactive visit'; END IF;
 SELECT * INTO g FROM public.gift_certificates WHERE code=_code AND status='paid' AND environment=_environment FOR UPDATE;
 IF NOT FOUND OR g.balance_cents<=0 THEN RAISE EXCEPTION 'Gift certificate is invalid or has no remaining credit'; END IF;
 applied:=LEAST(g.balance_cents,b.amount_cents-b.gift_credit_cents);
 IF applied<=0 THEN RAISE EXCEPTION 'This cleaning is already covered'; END IF;
 UPDATE public.gift_certificates SET balance_cents=balance_cents-applied WHERE id=g.id;
 UPDATE public.bookings SET gift_credit_cents=gift_credit_cents+applied WHERE id=b.id;
 INSERT INTO public.gift_redemptions(certificate_id,booking_id,amount_cents) VALUES(g.id,b.id,applied);
 RETURN applied;
END $$;
REVOKE ALL ON FUNCTION public.redeem_gift_certificate(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_gift_certificate(uuid,uuid,uuid,text) TO service_role;
CREATE FUNCTION public.release_cancelled_gift_credit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 IF NEW.status='cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND OLD.gift_credit_cents>0 THEN
  IF OLD.paid_at IS NOT NULL OR OLD.payment_checkout_started THEN RAISE EXCEPTION 'Payment has started; review payment before cancelling a gift-funded visit'; END IF;
  FOR r IN SELECT * FROM public.gift_redemptions WHERE booking_id=OLD.id AND released_at IS NULL ORDER BY certificate_id FOR UPDATE LOOP
   UPDATE public.gift_certificates SET balance_cents=balance_cents+r.amount_cents WHERE id=r.certificate_id;
   UPDATE public.gift_redemptions SET released_at=now() WHERE id=r.id;
  END LOOP;
  NEW.gift_credit_cents:=0;
 END IF;
 IF NEW.gift_credit_cents>NEW.amount_cents THEN RAISE EXCEPTION 'Gift credit cannot exceed the cleaning total'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER release_cancelled_gift_credit BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.release_cancelled_gift_credit();