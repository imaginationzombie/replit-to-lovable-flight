import { describe, expect, it } from "vitest";
import { canTip, canConfirmTip, canPayTip, TIP_CONFIRMATION_HOURS, tipAmountSchema, tipReceiptMatches } from "../lib/tips";
describe("optional customer tips", () => {
  it("opens when an assigned calendar appointment is confirmed, before the cleaning is charged", () => {
    expect(canTip({ status: "confirmed", paid_at: null, cleaner_id: "cleaner" })).toBe(true);
  });
  it("keeps completed visits eligible only when paid and assigned", () => {
    const b = { status: "completed", paid_at: "2026-11-02", cleaner_id: "cleaner" };
    expect(canTip(b)).toBe(true);
    expect(canTip({ ...b, status: "pending_payment" })).toBe(false);
    expect(canTip({ ...b, paid_at: null })).toBe(false);
    expect(canTip({ ...b, cleaner_id: null })).toBe(false);
  });
  it("does not offer tips on cancelled appointments or without an assigned housekeeper", () => {
    expect(canTip({ status: "cancelled", paid_at: null, cleaner_id: "cleaner" })).toBe(false);
    expect(canTip({ status: "confirmed", paid_at: null, cleaner_id: null })).toBe(false);
  });
  it("accepts dollar amounts without fractional cents", () => {
    expect(tipAmountSchema.safeParse(1000).success).toBe(true);
    expect(tipAmountSchema.safeParse(0).success).toBe(false);
    expect(tipAmountSchema.safeParse(100.5).success).toBe(false);
  });
  it("requires completed receipt matching exact tip amount and currency", () => {
    const r = { status: "COMPLETED", amount: { value: "10.00", currency_code: "USD" } };
    expect(tipReceiptMatches(r, 1000)).toBe(true);
    expect(tipReceiptMatches(r, 2000)).toBe(false);
    expect(tipReceiptMatches({ ...r, status: "PENDING" }, 1000)).toBe(false);
    expect(tipReceiptMatches({ ...r, amount: { value: "10.00", currency_code: "EUR" } }, 1000)).toBe(false);
  });
});
describe("tip customer confirmation", () => {
 it("allows exactly 24 hours and rejects the deadline and later", () => {
  const start = Date.parse("2026-11-12T17:00:00Z");
  expect(TIP_CONFIRMATION_HOURS).toBe(24);
  const tip = { status: "paid", customer_confirmed_at: null, confirmation_expires_at: "2026-11-13T17:00:00Z" };
  expect(canConfirmTip(tip, start + 24 * 3600000 - 1)).toBe(true);
  expect(canConfirmTip(tip, start + 24 * 3600000)).toBe(false);
 });
 it("never permits payout before explicit customer confirmation", () => {
  expect(canPayTip({ status: "paid", customer_confirmed_at: null })).toBe(false);
  expect(canPayTip({ status: "paid", customer_confirmed_at: "2026-11-12T18:00:00Z" })).toBe(true);
  expect(canPayTip({ status: "pending", customer_confirmed_at: "2026-11-12T18:00:00Z" })).toBe(false);
 });
});
