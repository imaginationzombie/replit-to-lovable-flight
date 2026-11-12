import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendTemplateEmail } from "./email-templates/send-email";
type Db = SupabaseClient<Database>;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export async function sendCustomerPaymentReceipt(db: Db, id: string) {
  const { data: b, error } = await db.from("bookings").select("id,email,customer_name,paid_at,paypal_capture_id,amount_cents,access_token").eq("id", id).single();
  if (error) throw new Error("Cannot load customer payment receipt.");
  if (!b?.paid_at || !b.paypal_capture_id) return { sent: false, reason: "not_paid" };
  return sendTemplateEmail("customer-payment-receipt", b.email, { templateData: { name: b.customer_name, amount: money(b.amount_cents), reference: b.paypal_capture_id, url: `https://housekeepingbooking.com/booking/${b.id}?t=${b.access_token}`, test: process.env['PAYPAL_ENV'] !== 'live' }, idempotencyKey: `customer-payment-${b.id}-${b.paypal_capture_id}` });
}
export async function sendCustomerTipReceipt(db: Db, id: string) {
  const { data: tip, error } = await db.from("booking_tips").select("*").eq("id", id).single();
  if (error) throw new Error("Cannot load tip receipt.");
  if (!tip || tip.status !== "paid" || !tip.paid_at || !tip.paypal_capture_id) return { sent: false, reason: "not_paid" };
  const { data: b, error: bookingError } = await db.from("bookings").select("id,email,customer_name,access_token").eq("id", tip.booking_id).single();
  if (bookingError || !b) throw new Error("Cannot load tip customer.");
  if (!tip.customer_confirmed_at && tip.confirmation_expires_at) {
    return sendTemplateEmail("tip-confirmation", b.email, { templateData: { name: b.customer_name, amount: money(tip.amount_cents), deadline: new Date(tip.confirmation_expires_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }) + " Eastern", url: `https://housekeepingbooking.com/booking/${b.id}?t=${b.access_token}`, test: tip.environment !== "live" }, idempotencyKey: `tip-confirm-${tip.id}-${tip.confirmation_requested_at}` });
  }
  return sendTemplateEmail("customer-tip-receipt", b.email, { templateData: { name: b.customer_name, amount: money(tip.amount_cents), reference: tip.paypal_capture_id, url: `https://housekeepingbooking.com/booking/${b.id}?t=${b.access_token}`, test: tip.environment !== "live" }, idempotencyKey: `customer-tip-${tip.id}-${tip.paypal_capture_id}` });
}
export async function sendCleanerPayoutReceipt(db: Db, id: string, kind: "work" | "tip") {
  let cleanerId: string; let amount: number; let reference: string;
  if (kind === "work") {
    const { data: payout, error } = await db.from("cleaner_payouts").select("*").eq("id", id).single();
    if (error) throw new Error("Cannot load earnings receipt.");
    if (!payout || payout.environment !== "live" || payout.status !== "paid" || payout.provider_status !== "SUCCESS" || !payout.paypal_item_id) return { sent: false, reason: "not_settled" };
    const { data: work, error: workError } = await db.from("appointment_work").select("status,paid_at").eq("id", payout.work_id).single();
    if (workError) throw new Error("Cannot load settled timesheet.");
    if (!work || work.status !== "paid" || !work.paid_at) return { sent: false, reason: "not_settled" };
    cleanerId = payout.cleaner_id; amount = payout.amount_cents; reference = payout.paypal_item_id;
  } else {
    const { data: tip, error } = await db.from("booking_tips").select("*").eq("id", id).single();
    if (error) throw new Error("Cannot load tip earnings.");
    if (!tip || tip.environment !== "live" || tip.status !== "paid" || tip.payout_status !== "paid" || !tip.payout_paid_at || !tip.paypal_item_id) return { sent: false, reason: "not_settled" };
    cleanerId = tip.cleaner_id; amount = tip.amount_cents; reference = tip.paypal_item_id;
  }
  const { data, error } = await db.auth.admin.getUserById(cleanerId);
  if (error) throw new Error("Cannot load cleaner receipt recipient.");
  if (!data.user?.email) return { sent: false, reason: "no_cleaner_email" };
  const template = kind === "work" ? "cleaner-payout-receipt" : "cleaner-tip-payout-receipt";
  return sendTemplateEmail(template, data.user.email, { templateData: { amount: money(amount), reference, url: "https://housekeepingbooking.com/timesheets" }, idempotencyKey: `${template}-${id}-${reference}` });
}

export async function notifyPaymentReceipt(db: Db, id: string, kind: "customer-payment" | "customer-tip" | "work" | "tip") {
  try {
    return await (kind === "customer-payment" ? sendCustomerPaymentReceipt(db, id) : kind === "customer-tip" ? sendCustomerTipReceipt(db, id) : sendCleanerPayoutReceipt(db, id, kind));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "send_failed";
    console.error("Payment receipt email not sent", { id, kind, code });
    return { sent: false, reason: code };
  }
}