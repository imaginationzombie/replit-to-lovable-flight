import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendBookingConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) return { sent: false, message: "Only admins can send booking confirmations." };
    const { data: booking, error } = await context.supabase.from("bookings").select("id, email, customer_name, status, service, preferred_date, time_window, address, frequency, cleaner_id, access_token").eq("id", data.bookingId).single();
    if (error || !booking) return { sent: false, message: "Booking not found." };
    if (booking.status !== "confirmed") return { sent: false, message: "Only confirmed visits can receive a confirmation." };
    let cleaner = "Assignment pending";
    if (booking.cleaner_id) {
      const { data: profile } = await context.supabase.from("profiles").select("full_name").eq("id", booking.cleaner_id).maybeSingle();
      cleaner = profile?.full_name || "Cleaner assigned";
    }
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const { EmailAPIError } = await import("@lovable.dev/email-js");
    try {
      const result = await sendTemplateEmail("booking-confirmation", booking.email, {
        templateData: { name: booking.customer_name, service: booking.service, date: new Date(`${booking.preferred_date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }), time: booking.time_window, address: booking.address, frequency: booking.frequency, cleaner, url: `https://housekeepingbooking.com/booking/${booking.id}?t=${booking.access_token}` },
        idempotencyKey: `booking-confirmation-${booking.id}-${booking.preferred_date}-${booking.time_window}-${booking.cleaner_id ?? "unassigned"}`,
      });
      return result.sent ? { sent: true, message: "Confirmation sent to the customer." } : { sent: false, message: "This customer’s address cannot receive app emails." };
    } catch (error) {
      if (error instanceof EmailAPIError) {
        if (error.code === "domain_not_verified") return { sent: false, message: "Sender domain is still verifying. Try again once verification finishes." };
        if (error.status === 429) return { sent: false, message: `Please wait ${error.retryAfterSeconds ?? 60} seconds before trying again.` };
      }
      return { sent: false, message: "Email wasn’t sent. Check email settings and try again." };
    }
  });