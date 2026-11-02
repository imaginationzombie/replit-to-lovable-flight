import { describe, expect, it } from "vitest";
import { cleaningSettlement, tipSettlement, type TipReceipt } from "../lib/customer-history";

describe("customer settlement records", () => {
  it("settles cleaning payments only with a recorded payment date", () => {
    expect(cleaningSettlement({ status: "completed", paid_at: "2026-11-02T15:00:00Z" })).toEqual({ status: "settled", date: "2026-11-02T15:00:00Z" });
    expect(cleaningSettlement({ status: "completed", paid_at: null }).status).toBe("due");
  });
  const tip: TipReceipt = { amount_cents: 1250, status: "paid", environment: "live", paid_at: "2026-11-02T15:00:00Z", payout_status: "pending", payout_paid_at: null };
  it("distinguishes a collected tip from delivery to the cleaner", () => {
    expect(tipSettlement(tip)).toEqual({ test: false, collectedAt: tip.paid_at, deliveredAt: null });
    expect(tipSettlement({ ...tip, payout_status: "paid", payout_paid_at: "2026-11-03T15:00:00Z" }).deliveredAt).toBe("2026-11-03T15:00:00Z");
  });
  it("never labels a sandbox transfer as real settlement", () => {
    expect(tipSettlement({ ...tip, environment: "sandbox", payout_status: "paid", payout_paid_at: "2026-11-03T15:00:00Z" }).deliveredAt).toBeNull();
  });
});