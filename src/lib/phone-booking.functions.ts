import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { phoneBookingSchema, phoneBookingRow, canSendPhoneEstimate, validatePhoneDate } from "./phone-booking";

export const savePhoneBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => phoneBookingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const [admin, cleaner] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "cleaner" }),
    ]);
    if (admin.error || cleaner.error || !(admin.data || cleaner.data)) throw new Error("Staff access required.");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    validatePhoneDate(data.preferredDate, today);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking, error } = await supabaseAdmin.from("bookings").insert(phoneBookingRow(data, context.userId)).select("id, amount_cents").single();
    if (error || !booking) throw new Error("Could not save this phone booking. Please try again.");
    return booking;
  });

export const sendPhoneEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [admin, cleaner] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "cleaner" }),
    ]);
    if (admin.error || cleaner.error || !(admin.data || cleaner.data)) throw new Error("Staff access required.");
    const { data: b, error } = await context.supabase.from("bookings").select("*").eq("id", data.bookingId).maybeSingle();
    if (error || !b || !b.created_by_staff || !canSendPhoneEstimate(Boolean(admin.data), Boolean(cleaner.data), context.userId, b.created_by_staff, b.status)) throw new Error("Only your pending phone bookings can receive an estimate.");
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const { EmailAPIError } = await import("@lovable.dev/email-js");
    try {
      const result = await sendTemplateEmail("booking-estimate", b.email, {
        idempotencyKey: `booking-estimate-${b.id}`,
        templateData: { name: b.customer_name, service: b.service, level: b.cleaning_level, date: b.preferred_date, time: b.time_window, address: b.address, frequency: b.frequency, home: `${b.bedrooms} bedrooms / ${b.bathrooms} bathrooms`, addOns: b.add_ons.join(", "), amount: `$${(b.amount_cents / 100).toFixed(2)}`, url: `https://housekeepingbooking.com/booking/${b.id}?t=${b.access_token}` },
      });
      return { sent: result.sent, message: result.sent ? "Estimate sent to the customer's email." : "Booking saved, but this address cannot receive app emails." };
    } catch (e) {
      if (e instanceof EmailAPIError && e.status === 429) return { sent: false, message: `Booking saved. Wait ${e.retryAfterSeconds ?? 60} seconds before trying email again.` };
      return { sent: false, message: "Booking saved, but the estimate email wasn't sent. Try again later." };
    }
  });