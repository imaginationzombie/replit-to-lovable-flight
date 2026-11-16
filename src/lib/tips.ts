import { z } from "zod";

export const tipAmountSchema = z.number().int().min(100).max(50000);
export const TIP_CONFIRMATION_HOURS = 24;
export function canConfirmTip(tip: { status: string; confirmation_expires_at: string | null; customer_confirmed_at: string | null }, now = Date.now()) {
  return tip.status === "paid" && !tip.customer_confirmed_at && !!tip.confirmation_expires_at && now < Date.parse(tip.confirmation_expires_at);
}
export function canPayTip(tip: { status: string; customer_confirmed_at: string | null }) { return tip.status === "paid" && !!tip.customer_confirmed_at; }
export function canTip(booking: { status: string; paid_at: string | null; cleaner_id: string | null }) {
  return !!booking.cleaner_id && (booking.status === "confirmed" || (booking.status === "completed" && !!booking.paid_at));
}
export function tipReceiptMatches(receipt: { status?: string; amount?: { value?: string; currency_code?: string } }, cents: number) {
  return receipt.status === "COMPLETED" && receipt.amount?.currency_code === "USD" && receipt.amount.value === (cents / 100).toFixed(2);
}