import { api, payoutEnvironment } from "./payouts.server";
import { canTip, canConfirmTip, canPayTip, tipReceiptMatches } from "./tips";
import { payoutOutcome, payoutValue } from "./payouts";
import { notifyPaymentReceipt } from "./payment-notices.server";

async function bookingAccess(id: string, token: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: booking, error } = await db.from("bookings").select("id,status,paid_at,cleaner_id").eq("id", id).eq("access_token", token).maybeSingle();
  if (error || !booking) throw new Error("Booking not found.");
  return { db, booking };
}
export async function getTip(id: string, token: string) {
  const { db } = await bookingAccess(id, token);
  const { data, error } = await db.from("booking_tips").select("amount_cents,status,environment,paid_at,payout_status,payout_paid_at,customer_confirmed_at,confirmation_expires_at").eq("booking_id", id).maybeSingle();
  if (error) throw new Error("Could not load tip receipt.");
  return data;
}
export async function startTip(id: string, token: string, amountCents: number) {
  const { db, booking } = await bookingAccess(id, token);
  if (!canTip(booking) || !booking.cleaner_id) throw new Error("Tips open after your appointment is confirmed and a housekeeper is assigned.");
  const { data: inserted, error } = await db.from("booking_tips").insert({ booking_id: id, cleaner_id: booking.cleaner_id, amount_cents: amountCents, environment: payoutEnvironment() }).select("*").maybeSingle();
  if (error && error.code !== "23505") throw new Error("Could not save your tip.");
  const { data: existing } = inserted ? { data: inserted } : await db.from("booking_tips").select("*").eq("booking_id", id).single();
  if (!existing) throw new Error("Could not load your tip.");
  if (existing.status === "paid") throw new Error("Thank you! This visit already has a paid tip.");
  if (existing.amount_cents !== amountCents) throw new Error(`A $${payoutValue(existing.amount_cents)} tip checkout already exists. Choose that amount to resume it.`);
  if (existing.paypal_order_id) return { orderId: existing.paypal_order_id };
  if (!inserted) throw new Error("Tip checkout is awaiting confirmation. Please contact us before trying another payment.");
  const response = await api("/v2/checkout/orders", "POST", { intent: "CAPTURE", purchase_units: [{ reference_id: inserted.id, description: "Cleaner tip – HousekeepingBooking.com", amount: { currency_code: "USD", value: payoutValue(amountCents) } }] }, inserted.environment, `tip-${inserted.id}`);
  const body = await response.json() as { id?: string };
  if (!response.ok || !body.id) throw new Error("PayPal could not start this tip. Please contact us before trying another payment.");
  const { error: save } = await db.from("booking_tips").update({ paypal_order_id: body.id }).eq("id", inserted.id);
  if (save) throw new Error("Tip checkout could not be saved. Please contact us before paying.");
  return { orderId: body.id };
}
export async function finishTip(id: string, token: string, orderId: string) {
  const { db } = await bookingAccess(id, token);
  const { data: tip } = await db.from("booking_tips").select("*").eq("booking_id", id).eq("paypal_order_id", orderId).single();
  if (!tip) throw new Error("Tip checkout not found.");
  if (tip.status === "paid") {
    await notifyPaymentReceipt(db, tip.id, "customer-tip");
    return { paid: true };
  }
  // Retrieve first: a previous successful capture may have lost its local receipt.
  let response = await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, "GET", undefined, tip.environment);
  if (!response.ok) throw new Error("Could not check your PayPal tip. No additional payment was sent.");
  type Order = { status?: string; purchase_units?: { reference_id?: string; payments?: { captures?: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }[] } }[] };
  let body = await response.json() as Order;
  if (body.status !== "COMPLETED") {
    response = await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, "POST", {}, tip.environment, `tip-cap-${tip.id}`);
    body = await response.json() as Order;
  }
  const unit = body.purchase_units?.[0];
  const receipt = unit?.payments?.captures?.[0];
  if (!response.ok || body.status !== "COMPLETED" || unit?.reference_id !== tip.id || !receipt?.id || !tipReceiptMatches(receipt, tip.amount_cents)) throw new Error("Your tip is not confirmed yet. Check PayPal before paying again.");
  const { error } = await db.from("booking_tips").update({ status: "paid", paypal_capture_id: receipt.id, paid_at: new Date().toISOString() }).eq("id", tip.id);
  if (error) throw new Error("PayPal received your tip. Please contact us to update the receipt; do not pay again.");
  await notifyPaymentReceipt(db, tip.id, "customer-tip");
  return { paid: true };
}

export async function transferTip(tipId: string, send: boolean) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: tip } = await db.from("booking_tips").select("*").eq("id", tipId).single();
  if (!tip || tip.status !== "paid") throw new Error("Only collected tips can be transferred.");
  if (send && !canPayTip(tip)) throw new Error("The customer must confirm the tip amount before payout.");
  let batch = tip.paypal_batch_id;
  let recipient = tip.recipient_email;
  if (!batch && send) {
    const { data: account } = await db.from("cleaner_payout_accounts").select("paypal_email").eq("user_id", tip.cleaner_id).single();
    if (!account) throw new Error("The cleaner must save a PayPal receiving email first.");
    recipient = account.paypal_email;
    const { data: locked, error } = await db.from("booking_tips").update({ payout_status: "sending", recipient_email: recipient }).eq("id", tip.id).eq("payout_status", "unpaid").select("id").maybeSingle();
    if (error || !locked) throw new Error("Transfer already started. Check its status instead of paying again.");
    try {
      const response = await api("/v1/payments/payouts", "POST", { sender_batch_header: { sender_batch_id: `tip-${tip.id}`, email_subject: "Your customer tip from HousekeepingBooking.com" }, items: [{ recipient_type: "EMAIL", receiver: recipient, amount: { value: payoutValue(tip.amount_cents), currency: "USD" }, sender_item_id: tip.id, note: "Customer cleaning tip" }] }, tip.environment);
      const body = await response.json() as { batch_header?: { payout_batch_id?: string } };
      if (!response.ok || !body.batch_header?.payout_batch_id) throw new Error("Unconfirmed transfer");
      batch = body.batch_header.payout_batch_id;
      const { error: saved } = await db.from("booking_tips").update({ paypal_batch_id: batch, payout_status: "pending" }).eq("id", tip.id);
      if (saved) throw new Error("Unsaved transfer");
    } catch {
      await db.from("booking_tips").update({ payout_status: "needs_review", payout_error: "Transfer result uncertain. Review PayPal before sending more money." }).eq("id", tip.id);
      return { message: "Transfer result uncertain. Review PayPal before sending more money." };
    }
  }
  if (!batch) return { message: tip.payout_error || "Review PayPal before sending more money. This transfer will not retry automatically." };
  const response = await api(`/v1/payments/payouts/${encodeURIComponent(batch)}?page_size=1`, "GET", undefined, tip.environment);
  if (!response.ok) throw new Error("Could not check transfer status. No additional payment was sent.");
  const body = await response.json() as { items?: { payout_item_id?: string; transaction_status?: string; payout_item?: { sender_item_id?: string; receiver?: string; amount?: { value?: string; currency?: string } } }[] };
  const item = body.items?.find(i => i.payout_item?.sender_item_id === tip.id);
  if (!item || item.payout_item?.receiver?.toLowerCase() !== recipient?.toLowerCase() || item.payout_item?.amount?.value !== payoutValue(tip.amount_cents) || item.payout_item.amount.currency !== "USD") throw new Error("Transfer receipt does not match this tip. Review required.");
  const status = payoutOutcome(item.transaction_status);
  const { error } = await db.from("booking_tips").update({ payout_status: status, paypal_item_id: item.payout_item_id ?? null, payout_paid_at: status === "paid" ? new Date().toISOString() : null }).eq("id", tip.id);
  if (error) throw new Error("Could not save transfer receipt. Check again; no new payment will be sent.");
  if (status === "paid" && tip.environment === "live") await notifyPaymentReceipt(db, tip.id, "tip");
  return { message: status === "paid" ? (tip.environment === "live" ? "Tip delivered through PayPal." : "Test tip transfer completed. No real money moved.") : `Tip transfer: ${status}.` };
}
export async function confirmCustomerTip(id: string, token: string) {
 const { db } = await bookingAccess(id, token);
 const { data: tip, error } = await db.from("booking_tips").select("*").eq("booking_id", id).single();
 if (error || !tip) throw new Error("Tip receipt not found.");
 if (!tip.customer_confirmed_at) {
  if (!canConfirmTip(tip)) throw new Error("The 24-hour confirmation period has ended. Your tip is held for review; contact us.");
  const { error: saved } = await db.from("booking_tips").update({ customer_confirmed_at: new Date().toISOString() }).eq("id", tip.id).is("customer_confirmed_at", null);
  if (saved) throw new Error("Could not confirm the tip. Refresh to check its status.");
 }
 await notifyPaymentReceipt(db, tip.id, "customer-tip");
 if (tip.payout_status !== "unpaid") return { message: "Tip confirmed. Payout is already being processed." };
 try { return await transferTip(tip.id, true); }
 catch { return { message: "Tip confirmed. Cleaner payout awaits review; you will not be charged again." }; }
}
