import { expect, it } from "vitest";
import { paymentGroup } from "../lib/payout-dashboard";
it("separates approved earnings from pending transfers", () => {
  const work = { status: "approved", paid_at: null };
  expect(paymentGroup(work, null)).toBe("approved");
  expect(paymentGroup(work, { environment: "live", status: "pending" })).toBe("pending");
});
it("requires a live success and paid timesheet receipt for settlement", () => {
  const work = { status: "paid", paid_at: "2026-11-02T16:00:00Z" };
  expect(paymentGroup(work, { environment: "live", status: "paid" })).toBe("settled");
  expect(paymentGroup(work, { environment: "sandbox", status: "paid" })).toBe("test");
  expect(paymentGroup(work, null)).toBe("recorded");
  expect(paymentGroup({ status: "approved", paid_at: null }, { environment: "live", status: "paid" })).toBe("review");
});
it("keeps failed and uncertain transfers out of the send queue", () => {
  for (const status of ["failed", "needs_review"]) expect(paymentGroup({ status: "approved", paid_at: null }, { environment: "live", status })).toBe("review");
});