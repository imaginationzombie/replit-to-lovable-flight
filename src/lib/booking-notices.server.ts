import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendTemplateEmail } from "./email-templates/send-email";

type Db = SupabaseClient<Database>;
function visitDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Fixed recipients from persisted records; called only after the feature's successful write. */
export async function sendBookingNotice(db: Db, bookingId: string) {
  const { data: b, error } = await db.from("bookings").select("id, email, customer_name, status, service, preferred_date, time_window, address, frequency, cleaner_id, access_token, paid_at").eq("id", bookingId).single();
  if (error) throw new Error("Cannot load booking for confirmation.");
  if (!b || b.status !== "confirmed") return { sent: false as const, reason: "not_confirmed" };
  let cleaner = "Assignment pending";
  if (b.cleaner_id) {
    const { data: profile } = await db.from("profiles").select("full_name").eq("id", b.cleaner_id).maybeSingle();
    cleaner = profile?.full_name || "Cleaner assigned";
  }
  return sendTemplateEmail("booking-confirmation", b.email, {
    templateData: { name: b.customer_name, service: b.service, date: visitDate(b.preferred_date), time: b.time_window, address: b.address, frequency: b.frequency, cleaner, paid: Boolean(b.paid_at), url: `https://housekeepingbooking.com/booking/${b.id}?t=${b.access_token}` },
    idempotencyKey: `booking-confirmation-${b.id}-${b.preferred_date}-${b.time_window}-${b.cleaner_id ?? "unassigned"}`,
  });
}

export async function sendCleanerPaymentNotice(db: Db, bookingId: string) {
  const { data: b, error } = await db.from("bookings").select("id, cleaner_id, service, preferred_date, amount_cents, paid_at, paypal_capture_id").eq("id", bookingId).single();
  if (error) throw new Error("Cannot load customer payment for notification.");
  if (!b?.cleaner_id || !b.paid_at || !b.paypal_capture_id) return { sent: false as const, reason: "no_paid_assignment" };
  // Use the cleaner's account address, never their PayPal receiving address or a browser-provided address.
  const { data, error: userError } = await db.auth.admin.getUserById(b.cleaner_id);
  if (userError) throw new Error("Cannot load cleaner for payment notification.");
  if (!data.user?.email) return { sent: false as const, reason: "no_cleaner_email" };
  const { data: profile } = await db.from("profiles").select("full_name").eq("id", b.cleaner_id).maybeSingle();
  return sendTemplateEmail("cleaner-payment-confirmation", data.user.email, {
    templateData: { name: profile?.full_name, service: b.service, date: visitDate(b.preferred_date), amount: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(b.amount_cents / 100), reference: b.paypal_capture_id, test: process.env["PAYPAL_ENV"] !== "live" },
    idempotencyKey: `cleaner-payment-${b.id}-${b.paypal_capture_id}-${b.cleaner_id}`,
  });
}

export async function sendOwnerBookingNotice(db: Db, bookingId: string) {
  const { data: b, error } = await db.from("bookings").select("id, status, customer_name, email, phone, service, preferred_date, time_window, address, frequency, cleaner_id, amount_cents").eq("id", bookingId).single();
  if (error) throw new Error("Cannot load appointment for owner notification.");
  if (!b || b.status !== "confirmed") return { sent: false as const, reason: "not_confirmed" };
  let cleaner = "Assignment pending";
  if (b.cleaner_id) {
    const { data: profile } = await db.from("profiles").select("full_name").eq("id", b.cleaner_id).maybeSingle();
    cleaner = profile?.full_name || "Cleaner assigned";
  }
  return sendTemplateEmail("owner-booking-notification", "", {
    templateData: { name: b.customer_name, email: b.email, phone: b.phone, service: b.service, date: visitDate(b.preferred_date), time: b.time_window, address: b.address, frequency: b.frequency, cleaner, amount: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(b.amount_cents / 100) },
    idempotencyKey: `owner-booking-notification-${b.id}`,
  });
}

/** Email outages must never turn a successful payment into a failed checkout or another charge. */
export async function notifyBookingEvent(db: Db, id: string, event: "confirmed" | "paid") {
  // Attempt each recipient independently: a customer email failure must not hide a new booking from the owner.
  if (event === "confirmed") {
    await safeBookingNotice(() => sendOwnerBookingNotice(db, id), id, "owner-confirmed");
  }
  return safeBookingNotice(() => event === "confirmed" ? sendBookingNotice(db, id) : sendCleanerPaymentNotice(db, id), id, event);
}

async function safeBookingNotice(send: () => Promise<{ sent: boolean; reason?: string }>, id: string, event: string) {
  try {
    return await send();
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "send_failed";
    console.error("Booking email not sent", { bookingId: id, event, code });
    return { sent: false as const, reason: code };
  }
}