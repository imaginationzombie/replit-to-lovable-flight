import { expect, it } from "vitest";
import { payoutOutcome, payoutValue } from "../lib/payouts";
it("does not mark accepted, pending or unclaimed transfers paid", () => {
  for (const status of ["PENDING", "UNCLAIMED", "ONHOLD", undefined]) expect(payoutOutcome(status)).toBe("pending");
  expect(payoutOutcome("SUCCESS")).toBe("paid");
});
it("tracks failed and returned transfers separately from successful payments", () => {
  expect(payoutOutcome("FAILED")).toBe("failed");
  expect(payoutOutcome("RETURNED")).toBe("failed");
});
it("transfers the full approved amount in dollars and cents", () => {
  expect(payoutValue(6250)).toBe("62.50");
  expect(() => payoutValue(0)).toThrow();
});