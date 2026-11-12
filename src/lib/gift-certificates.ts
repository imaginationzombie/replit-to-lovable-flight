import { z } from "zod";
export const GIFT_AMOUNTS = [5000, 10000, 15000] as const;
export const giftPurchaseSchema = z.object({ amountCents: z.union([z.literal(5000), z.literal(10000), z.literal(15000)]), recipientName: z.string().trim().max(100), message: z.string().trim().max(500), purchaseId: z.string().uuid() });
export function bookingBalance(b: { amount_cents: number; gift_credit_cents?: number }) { return Math.max(0, b.amount_cents - (b.gift_credit_cents ?? 0)); }
export function giftReceiptMatches(order: { status?: string; purchase_units?: { reference_id?: string; payments?: { captures?: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }[] } }[] }, id: string, cents: number) {
  const unit = order.purchase_units?.[0]; const capture = unit?.payments?.captures?.[0];
  return order.status === "COMPLETED" && unit?.reference_id === id && Boolean(capture?.id) && capture?.status === "COMPLETED" && capture.amount?.currency_code === "USD" && Math.round(Number(capture.amount.value) * 100) === cents;
}