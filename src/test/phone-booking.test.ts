import { describe, expect, it } from "vitest";
import { phoneBookingRow, phoneBookingSchema, canSendPhoneEstimate, validatePhoneDate } from "../lib/phone-booking";
const input = phoneBookingSchema.parse({ customerName: "Caller Customer", email: "caller@example.com", phone: "8145550100", address: "100 Example Street", serviceArea: "Lewistown, PA", service: "Standard Housekeeping", frequency: "Weekly", bedrooms: 3, bathrooms: 2, addOns: ["Oven Degrease", "Refrigerator Interior", "Window Detailing"], rush: false, cleaningLevel: "Medium", preferredDate: "2026-11-10", timeWindow: "Afternoon (12pm–4pm)", notes: "Caller request" });
describe("staff phone bookings", () => {
  it("saves caller details and shared pricing without granting customer ownership to staff", () => {
    const row = phoneBookingRow(input, "staff-id");
    expect(row).toMatchObject({ email: "caller@example.com", created_by_staff: "staff-id", user_id: null, cleaner_id: null, status: "pending_payment", amount_cents: 15000, preferred_date: "2026-11-10", time_window: "Afternoon (12pm–4pm)" });
  });
  it("allows housekeepers to email only their own pending requests", () => {
    expect(canSendPhoneEstimate(false, true, "staff-a", "staff-a", "pending_payment")).toBe(true);
    expect(canSendPhoneEstimate(false, true, "staff-a", "staff-b", "pending_payment")).toBe(false);
  });
  it("allows admins to email pending requests but never confirmed bookings as estimates", () => {
    expect(canSendPhoneEstimate(true, false, "admin", "staff", "pending_payment")).toBe(true);
    expect(canSendPhoneEstimate(true, true, "admin", "staff", "confirmed")).toBe(false);
    expect(canSendPhoneEstimate(false, false, "customer", "customer", "pending_payment")).toBe(false);
  });
  it("rejects past or impossible requested dates", () => {
    expect(() => validatePhoneDate("2026-11-02", "2026-11-03")).toThrow();
    expect(() => validatePhoneDate("2026-02-30", "2026-02-01")).toThrow();
    expect(() => validatePhoneDate("2026-11-03", "2026-11-03")).not.toThrow();
  });
});