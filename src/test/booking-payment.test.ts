import { expect, it } from "vitest";
import { canPayBooking } from "../lib/booking-payment";

it("allows payment only after cleaning, preserving zero upfront", () => {
  expect(canPayBooking({ status: "confirmed", access_token: "token" })).toBe(false);
  expect(canPayBooking({ status: "completed", access_token: "token" })).toBe(true);
});
it("prevents another payment for an already paid booking", () => {
  expect(canPayBooking({ status: "completed", access_token: "token", paid_at: "2026-11-02" })).toBe(false);
});