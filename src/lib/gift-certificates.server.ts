import { api, payoutEnvironment } from "./payouts.server";
import { giftReceiptMatches, type giftPurchaseSchema } from "./gift-certificates";
import type { z } from "zod";
import { sendTemplateEmail } from "./email-templates/send-email";

export async function startGift(userId: string, input: z.infer<typeof giftPurchaseSchema>) {
 const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
 const { data: account } = await db.auth.admin.getUserById(userId);
 if (!account.user?.email) throw new Error("Your account email is required.");
 const { data: existing } = await db.from("gift_certificates").select("*").eq("id", input.purchaseId).eq("buyer_id", userId).maybeSingle();
 const gift = existing ?? (await db.from("gift_certificates").insert({ id: input.purchaseId, buyer_id: userId, buyer_email: account.user.email, amount_cents: input.amountCents, recipient_name: input.recipientName, message: input.message, environment: payoutEnvironment() }).select("*").single()).data;
 if (!gift || gift.amount_cents !== input.amountCents || gift.environment !== payoutEnvironment()) throw new Error("Could not save this gift purchase. Refresh before trying again.");
 if (gift.status === "paid") throw new Error("This certificate is already paid.");
 if (gift.paypal_order_id) return { orderId: gift.paypal_order_id, id: gift.id };
 const response = await api("/v2/checkout/orders", "POST", { intent: "CAPTURE", purchase_units: [{ reference_id: gift.id, description: "Housekeeping gift certificate", amount: { currency_code: "USD", value: (gift.amount_cents / 100).toFixed(2) } }] }, gift.environment, `gift-${gift.id}`);
 const body = await response.json() as { id?: string };
 if (!response.ok || !body.id) throw new Error("PayPal could not start this gift purchase.");
 const { error } = await db.from("gift_certificates").update({ paypal_order_id: body.id }).eq("id", gift.id);
 if (error) throw new Error("Could not save checkout. Do not pay again; contact us.");
 return { orderId: body.id, id: gift.id };
}
export async function finishGift(userId: string, id: string, orderId: string) {
 const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
 const { data: gift } = await db.from("gift_certificates").select("*").eq("id", id).eq("buyer_id", userId).eq("paypal_order_id", orderId).single();
 if (!gift) throw new Error("Gift purchase not found.");
 if (gift.status !== "paid") {
  let response = await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, "GET", undefined, gift.environment);
  type Order = Parameters<typeof giftReceiptMatches>[0];
  let body = await response.json() as Order;
  if (response.ok && body.status !== "COMPLETED") { response = await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, "POST", {}, gift.environment, `gift-cap-${gift.id}`); body = await response.json() as Order; }
  if (!response.ok || !giftReceiptMatches(body, gift.id, gift.amount_cents)) throw new Error("Gift payment is not confirmed. Check PayPal before paying again.");
  const captureId = body.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  if (!captureId) throw new Error("Receipt unavailable.");
  const { error } = await db.from("gift_certificates").update({ status: "paid", balance_cents: gift.amount_cents, paypal_capture_id: captureId, paid_at: new Date().toISOString() }).eq("id", gift.id).eq("status", "pending");
  if (error) throw new Error("PayPal received payment; contact us to restore the certificate. Do not pay again.");
 }
 let emailed = false;
 try { const result = await sendTemplateEmail("gift-certificate", gift.buyer_email, { templateData: { amount: `$${(gift.amount_cents / 100).toFixed(2)}`, recipientName: gift.recipient_name, message: gift.message, test: gift.environment !== "live", url: `https://housekeepingbooking.com/gift/${gift.id}?t=${gift.access_token}` }, idempotencyKey: `gift-receipt-${gift.id}` }); emailed = result.sent; } catch { /* Paid certificate remains available even if email fails. */ }
 return { id: gift.id, token: gift.access_token, emailed };
}
export async function readGift(id: string, token: string) {
 const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
 const { data } = await db.from("gift_certificates").select("id,amount_cents,balance_cents,recipient_name,message,code,status,environment").eq("id", id).eq("access_token", token).eq("status", "paid").maybeSingle();
 return data;
}
export async function redeemGift(id: string, token: string, code: string) {
 const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
 const { data, error } = await db.rpc("redeem_gift_certificate", { _booking: id, _token: token, _code: code, _environment: payoutEnvironment() });
 if (error) throw new Error(error.message);
 return { appliedCents: data };
}