ALTER TABLE public.booking_tips ADD COLUMN confirmation_requested_at timestamptz, ADD COLUMN confirmation_expires_at timestamptz, ADD COLUMN customer_confirmed_at timestamptz;
CREATE FUNCTION public.guard_tip_confirmation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status='paid' AND NEW.confirmation_requested_at IS NULL AND NEW.customer_confirmed_at IS NULL THEN
  NEW.confirmation_requested_at:=now(); NEW.confirmation_expires_at:=now()+interval '24 hours';
 END IF;
 IF NEW.customer_confirmed_at IS DISTINCT FROM OLD.customer_confirmed_at THEN
  IF OLD.customer_confirmed_at IS NOT NULL OR NEW.status<>'paid' OR NEW.paypal_capture_id IS NULL OR NEW.paid_at IS NULL OR NEW.confirmation_expires_at IS NULL OR now()>=NEW.confirmation_expires_at THEN RAISE EXCEPTION 'Tip confirmation has expired or payment is not verified.'; END IF;
  NEW.customer_confirmed_at:=now();
 END IF;
 IF NEW.payout_status='sending' AND OLD.payout_status IS DISTINCT FROM 'sending' AND NEW.customer_confirmed_at IS NULL THEN RAISE EXCEPTION 'Customer must confirm the tip before payout.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tip_confirmation_guard BEFORE UPDATE ON public.booking_tips FOR EACH ROW EXECUTE FUNCTION public.guard_tip_confirmation();
CREATE TABLE public.appointment_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES public.bookings(id), author_id uuid NOT NULL REFERENCES public.profiles(id), body text NOT NULL, requested_add_ons text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.appointment_notes TO authenticated;
GRANT ALL ON public.appointment_notes TO service_role;
ALTER TABLE public.appointment_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assigned cleaner and admin appointment notes" ON public.appointment_notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'cleaner') AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=booking_id AND b.cleaner_id=auth.uid())));
CREATE FUNCTION public.add_appointment_note(_booking uuid,_body text,_add_ons text[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings%ROWTYPE; result uuid;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=_booking FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR NOT (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'cleaner') AND b.cleaner_id=auth.uid())) THEN RAISE EXCEPTION 'Appointment access required.'; END IF;
 IF length(trim(COALESCE(_body,''))) NOT BETWEEN 1 AND 2000 OR cardinality(_add_ons)>12 OR NOT COALESCE(_add_ons,'{}') <@ ARRAY['Refrigerator Interior','Oven Degrease','Window Detailing','Baseboards & Blinds','Cabinet Interiors','Patio & Porch Sweep','Eco Pet Odor & Fur','Dishwasher Descale','Hardwood Floor Buff','Microwave & Hood','Linen Bed Dressing','Grout & Scale Descale']::text[] THEN RAISE EXCEPTION 'Enter a valid note and add-ons.'; END IF;
 INSERT INTO public.appointment_notes(booking_id,author_id,body,requested_add_ons) VALUES(b.id,auth.uid(),trim(_body),COALESCE(_add_ons,'{}')) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.add_appointment_note(uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_appointment_note(uuid,text,text[]) TO authenticated;