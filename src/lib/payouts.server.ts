import { payoutOutcome, payoutValue } from "./payouts";
import type { Database } from "@/integrations/supabase/types";
type Payout = Database["public"]["Tables"]["cleaner_payouts"]["Row"];

export function payoutEnvironment() { return process.env["PAYPAL_ENV"] === "live" ? "live" : "sandbox"; }
export function payoutsConfigured() { return !!process.env["PAYPAL_CLIENT_ID"] && !!process.env["PAYPAL_CLIENT_SECRET"]; }
async function api(path: string, method = "GET", body?: unknown, environment = payoutEnvironment()) {
  const id = process.env["PAYPAL_CLIENT_ID"]; const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("PayPal credentials are not configured.");
  const base = environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const auth = await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(15000) });
  if (!auth.ok) throw new Error("Could not authenticate with PayPal. Check the configured credentials.");
  const token = (await auth.json()) as { access_token: string };
  return fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
}

export async function transferPayout(payout: Payout, send: boolean) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  let batch = payout.paypal_batch_id;
  if (!batch && send) {
    // Permanent one-shot claim: ambiguous sends never automatically submit again.
    const { data: locked, error: lockError } = await db.from("cleaner_payouts").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", payout.id).eq("status", "processing").select("id").maybeSingle();
    if (lockError) throw new Error("Could not reserve this transfer safely.");
    if (!locked) return "Transfer already started. Check its status; do not send another payment.";
    try {
      const response = await api("/v1/payments/payouts", "POST", {
        sender_batch_header: { sender_batch_id: payout.id, email_subject: "Your cleaning earnings from HousekeepingBooking.com", email_message: "Payment for your approved cleaning timesheet." },
        items: [{ recipient_type: "EMAIL", receiver: payout.recipient_email, amount: { value: payoutValue(payout.amount_cents), currency: payout.currency }, sender_item_id: payout.id, note: "Approved cleaning earnings" }],
      }, payout.environment);
      const body = await response.json() as { batch_header?: { payout_batch_id?: string }; name?: string };
      if (!response.ok || !body.batch_header?.payout_batch_id) {
        const reason = response.status === 403 ? "PayPal has not authorized Payouts for this business account. Request Payouts access in PayPal." : "PayPal did not confirm this transfer. Review your PayPal account before making another payment.";
        await db.from("cleaner_payouts").update({ status: "needs_review", error_message: reason }).eq("id", payout.id);
        return reason;
      }
      batch = body.batch_header.payout_batch_id;
      const { error } = await db.from("cleaner_payouts").update({ paypal_batch_id: batch, status: "pending", error_message: "" }).eq("id", payout.id);
      if (error) throw new Error("PayPal accepted the transfer but its receipt could not be saved. Review PayPal before retrying.");
    } catch {
      await db.from("cleaner_payouts").update({ status: "needs_review", error_message: "Transfer result is uncertain. Review PayPal before sending any additional payment." }).eq("id", payout.id);
      return "Transfer result is uncertain. Review PayPal before sending any additional payment.";
    }
  }
  if (!batch) return payout.error_message || "Transfer is awaiting reconciliation. Review your PayPal account; it will not be sent again automatically.";
  const response = await api(`/v1/payments/payouts/${encodeURIComponent(batch)}?page_size=1`, "GET", undefined, payout.environment);
  if (!response.ok) throw new Error("Could not check PayPal transfer status. No additional payment was sent.");
  const body = await response.json() as { items?: { payout_item_id?: string; transaction_status?: string; payout_item?: { sender_item_id?: string; amount?: { value?: string; currency?: string }; receiver?: string } }[] };
  const item = body.items?.find(i => i.payout_item?.sender_item_id === payout.id);
  if (!item) throw new Error("PayPal has not returned this transfer item yet. Check again shortly.");
  if (item.payout_item?.amount?.value !== payoutValue(payout.amount_cents) || item.payout_item.amount.currency !== payout.currency || item.payout_item.receiver?.toLowerCase() !== payout.recipient_email.toLowerCase()) throw new Error("PayPal receipt does not match the approved payment. Review required.");
  const outcome = payoutOutcome(item.transaction_status);
  const { error: saveError } = await db.from("cleaner_payouts").update({ status: outcome, provider_status: item.transaction_status, paypal_item_id: item.payout_item_id, updated_at: new Date().toISOString() }).eq("id", payout.id);
  if (saveError) throw new Error("Could not save transfer status. Check again; no additional payment will be sent.");
  // Test transfers never settle real cleaner earnings.
  if (outcome === "paid" && payout.environment === "live") {
    const { error } = await db.from("appointment_work").update({ status: "paid", paid_at: new Date().toISOString(), payment_reference: `PayPal ${item.payout_item_id ?? batch}` }).eq("id", payout.work_id);
    if (error) throw new Error("PayPal paid this transfer. Check status again to update the timesheet.");
  }
  if (outcome === "failed" && payout.environment === "live") {
    const { error } = await db.from("appointment_work").update({ status: "approved", paid_at: null, payment_reference: "" }).eq("id", payout.work_id);
    if (error) throw new Error("Could not update the returned transfer. Review required.");
  }
  return outcome === "paid" ? (payout.environment === "live" ? "Payment delivered through PayPal." : "Test transfer completed. No real money moved.") : `PayPal transfer: ${item.transaction_status ?? "pending"}.`;
}