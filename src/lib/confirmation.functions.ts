import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canSendConfirmation } from "./confirmation";

export const sendBookingConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) return { sent: false, message: "Only admins can send booking confirmations." };
    const { data: booking, error } = await context.supabase.from("bookings").select("id, email, customer_name, status, service, preferred_date, time_window, address, frequency, cleaner_id, access_token").eq("id", data.bookingId).single();
    if (error || !booking) return { sent: false, message: "Booking not found." };
    if (!canSendConfirmation(admin, booking.status)) return { sent: false, message: "Only confirmed visits can receive a confirmation." };
    const { sendBookingNotice } = await import("./booking-notices.server");
    const { EmailAPIError } = await import("@lovable.dev/email-js");
    try {
      const result = await sendBookingNotice(context.supabase, booking.id);
      return result.sent ? { sent: true, message: "Confirmation sent to the customer." } : { sent: false, message: "This customer’s address cannot receive app emails." };
    } catch (error) {
      if (error instanceof EmailAPIError) {
        if (error.code === "domain_not_verified") return { sent: false, message: "Sender domain is still verifying. Try again once verification finishes." };
        if (error.status === 429) return { sent: false, message: `Please wait ${error.retryAfterSeconds ?? 60} seconds before trying again.` };
      }
      return { sent: false, message: "Email wasn’t sent. Check email settings and try again." };
    }
  });