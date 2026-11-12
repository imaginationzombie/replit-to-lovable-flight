import { expect, it, vi } from "vitest";
import { GIFT_AMOUNTS, giftPurchaseSchema, bookingBalance, giftReceiptMatches } from "../lib/gift-certificates";
it("offers exactly $50, $100 and $150 certificates", () => { expect(GIFT_AMOUNTS).toEqual([5000,10000,15000]); expect(giftPurchaseSchema.safeParse({ amountCents: 7500, recipientName: "", message: "", purchaseId: "472ebb5d-1d5f-4706-a958-c5d1a000f6d8" }).success).toBe(false); });
it("uses gift credit toward part of a cleaning", () => expect(bookingBalance({ amount_cents: 9500, gift_credit_cents: 5000 })).toBe(4500));
it("never charges a negative balance for a fully covered cleaning", () => expect(bookingBalance({ amount_cents: 9500, gift_credit_cents: 9500 })).toBe(0));
it("issues credit only from a completed matching USD capture", () => {
 const order = { status: "COMPLETED", purchase_units: [{ reference_id: "gift-1", payments: { captures: [{ id: "cap-1", status: "COMPLETED", amount: { value: "100.00", currency_code: "USD" } }] } }] };
 expect(giftReceiptMatches(order, "gift-1", 10000)).toBe(true);
 expect(giftReceiptMatches(order, "gift-1", 5000)).toBe(false);
 expect(giftReceiptMatches(order, "gift-2", 10000)).toBe(false);
 expect(giftReceiptMatches({ ...order, status: "APPROVED" }, "gift-1", 10000)).toBe(false);
});