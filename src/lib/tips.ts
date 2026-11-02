import { z } from "zod";

export const tipAmountSchema = z.number().int().min(100).max(50000);
export function canTip(booking: { status: string; paid_at: string | null; cleaner_id: string | null }) {
  return booking.status === "completed" && !!booking.paid_at && !!booking.cleaner_id;
}
export function tipReceiptMatches(receipt: { status?: string; amount?: { value?: string; currency_code?: string } }, cents: number) {
  return receipt.status === "COMPLETED" && receipt.amount?.currency_code === "USD" && receipt.amount.value === (cents / 100).toFixed(2);
}