ALTER TABLE public.bookings ADD COLUMN service_quote jsonb, ADD COLUMN quote_reviewed_at timestamptz, ADD COLUMN quote_reviewed_by uuid REFERENCES public.profiles(id), ADD COLUMN quote_review_notes text NOT NULL DEFAULT '', ADD COLUMN quote_payment_environment text;
CREATE FUNCTION public.guard_service_quote_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.service_quote IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND (NEW.quote_reviewed_at IS NOT NULL OR NEW.status<>'pending_payment') THEN RAISE EXCEPTION 'Submit your quote for phone review first.'; END IF;
 IF TG_OP='UPDATE' AND NEW.service_quote IS DISTINCT FROM OLD.service_quote THEN RAISE EXCEPTION 'Submit a new request for a changed quote.'; END IF;
 IF NEW.status IN ('confirmed','completed') AND (NEW.quote_reviewed_at IS NULL OR NEW.paid_at IS NULL OR NEW.paypal_capture_id IS NULL OR NEW.quote_payment_environment IS DISTINCT FROM 'live') THEN RAISE EXCEPTION 'Phone review and verified payment are required before confirmation.'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER zz_service_quote_guard BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_service_quote_booking();
DO $$ DECLARE n text; d text; BEGIN FOREACH n IN ARRAY ARRAY['public_appointment_slots','validate_appointment_slot_booking','guard_slot_schedule_conflicts','save_appointment_slot'] LOOP
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=n;
 d:=replace(d,$s$b.created_at>now()-interval '30 minutes'$s$,$s$QUOTE_HOLD_ALIAS$s$);
 d:=replace(d,$s$created_at>now()-interval '30 minutes'$s$,$s$(service_quote IS NOT NULL OR created_at>now()-interval '30 minutes')$s$);
 d:=replace(d,'QUOTE_HOLD_ALIAS',$s$(b.service_quote IS NOT NULL OR b.created_at>now()-interval '30 minutes')$s$);
 EXECUTE d;
 END LOOP; END $$;
CREATE FUNCTION public.review_service_quote(_booking uuid,_approve boolean,_notes text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE b public.bookings%ROWTYPE; BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=_booking FOR UPDATE;
 IF auth.uid() IS NULL OR b.cleaner_id IS DISTINCT FROM auth.uid() OR NOT public.has_role(auth.uid(),'cleaner') THEN RAISE EXCEPTION 'Only the assigned housekeeper can confirm this quote.'; END IF;
 IF b.service_quote IS NULL OR b.status<>'pending_payment' OR b.quote_reviewed_at IS NOT NULL OR b.paypal_order_id IS NOT NULL THEN RAISE EXCEPTION 'This quote is no longer awaiting review.'; END IF;
 IF length(trim(_notes))<5 OR length(_notes)>1500 THEN RAISE EXCEPTION 'Add the phone review details.'; END IF;
 IF _approve THEN UPDATE public.bookings SET quote_reviewed_at=now(),quote_reviewed_by=auth.uid(),quote_review_notes=trim(_notes) WHERE id=_booking;
 ELSE UPDATE public.bookings SET status='cancelled',quote_review_notes=trim(_notes) WHERE id=_booking; END IF;
 END $$;
REVOKE ALL ON FUNCTION public.review_service_quote(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_service_quote(uuid,boolean,text) TO authenticated;