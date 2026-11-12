CREATE FUNCTION public.guard_booking_gift_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND (NEW.gift_credit_cents IS DISTINCT FROM OLD.gift_credit_cents OR NEW.payment_checkout_started IS DISTINCT FROM OLD.payment_checkout_started) THEN RAISE EXCEPTION 'Gift credits can only be changed through verified redemption'; END IF;
 IF OLD.gift_credit_cents>0 AND NEW.amount_cents IS DISTINCT FROM OLD.amount_cents THEN RAISE EXCEPTION 'Review gift credit before changing the cleaning total'; END IF;
 IF NEW.status='completed' AND NEW.gift_credit_cents=NEW.amount_cents AND NEW.amount_cents>0 THEN NEW.paid_at:=COALESCE(OLD.paid_at,now()); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_guard_booking_gift_payment BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_booking_gift_payment();