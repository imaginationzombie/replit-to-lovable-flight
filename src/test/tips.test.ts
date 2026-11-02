import { describe, expect, it } from "vitest";
import { canTip, tipAmountSchema, tipReceiptMatches } from "../lib/tips";
describe("optional customer tips", () => {
  it("only opens after an assigned visit is completed and paid", () => {
    const b = { status: "completed", paid_at: "2026-11-02", cleaner_id: "cleaner" };
    expect(canTip(b)).toBe(true);
    expect(canTip({ ...b, status: "confirmed" })).toBe(false);
    expect(canTip({ ...b, paid_at: null })).toBe(false);
    expect(canTip({ ...b, cleaner_id: null })).toBe(false);
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