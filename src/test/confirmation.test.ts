import { expect, it } from "vitest";
import { canSendConfirmation } from "../lib/confirmation";
it("allows admins to send confirmed visit emails", () => expect(canSendConfirmation(true, "confirmed")).toBe(true));
it("denies non-admin sends", () => expect(canSendConfirmation(false, "confirmed")).toBe(false));
it("does not send confirmations for cancelled or unfinished visits", () => {
  expect(canSendConfirmation(true, "cancelled")).toBe(false);
  expect(canSendConfirmation(true, "pending_payment")).toBe(false);
});