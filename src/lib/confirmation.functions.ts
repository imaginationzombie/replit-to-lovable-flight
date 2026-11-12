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
    const { sendParticipantConfirmations } = await import("./booking-notices.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const result = await sendParticipantConfirmations(supabaseAdmin, booking.id);
      const sent = result.customer.sent && (!booking.cleaner_id || result.cleaner.sent);
      return { sent, message: [result.customer.sent ? "Customer confirmation accepted for sending." : "Customer confirmation was not sent.", booking.cleaner_id ? (result.cleaner.sent ? "Housekeeper confirmation accepted for sending." : "Housekeeper confirmation was not sent; retry after checking email settings.") : "Housekeeper assignment is pending."].join(" ") };
    } catch (error) {
      return { sent: false, message: "Email wasn’t sent. Check email settings and try again." };
    }
  });