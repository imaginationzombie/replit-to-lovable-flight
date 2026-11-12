import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), error: null as { message: string } | null }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  const q = { insert: (data: unknown) => { mocks.insert(data); return q; }, select: () => q,
    single: async () => ({ data: mocks.error ? null : { id: "booking-id" }, error: mocks.error }),
    update: () => q, eq: async () => ({ error: null }) };
  return q;
} } }));
vi.mock("../lib/booking-notices.server", () => ({ notifyBookingEvent: vi.fn() }));
import { createBookingOrder } from "../lib/booking.server";
const input = { customerName: "Test Customer", email: "test@example.com", phone: "5550000000", address: "Test address", serviceArea: "Lewistown, PA", service: "Standard Housekeeping", frequency: "One-time", bedrooms: 3, bathrooms: 2, addOns: [], rush: false, preferredDate: "2026-11-10", timeWindow: "Afternoon (12pm–4pm)", notes: "", requestedCleanerId: "11111111-1111-4111-8111-111111111111" };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); mocks.insert.mockClear(); mocks.error = null; });
it("preserves the customer's chosen housekeeper, date, time and estimator price", async () => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "test"); vi.stubEnv("PAYPAL_CLIENT_SECRET", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ access_token: "test" })).mockResolvedValueOnce(Response.json({ id: "order-test" })));
  await createBookingOrder(input, null);
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ requested_cleaner_id: input.requestedCleanerId, preferred_date: "2026-11-10", time_window: "Afternoon (12pm–4pm)", amount_cents: 12000 }));
});
it("does not open PayPal when the selected housekeeper cannot accept the appointment", async () => {
  mocks.error = { message: "This housekeeper is unavailable on that date. Choose another date." };
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(createBookingOrder(input, null)).rejects.toThrow("unavailable on that date");
  expect(fetch).not.toHaveBeenCalled();
});
it("saves Heavy level and includes its $30 fee in the PayPal order", async () => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "test"); vi.stubEnv("PAYPAL_CLIENT_SECRET", "test");
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "test" })).mockResolvedValueOnce(Response.json({ id: "order-test" }));
  vi.stubGlobal("fetch", fetch);
  await createBookingOrder({ ...input, cleaningLevel: "Heavy" }, null);
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ cleaning_level: "Heavy", amount_cents: 15000 }));
  const order = JSON.parse(fetch.mock.calls[1]?.[1]?.body ?? "{}");
  expect(order.purchase_units[0].amount.value).toBe("150.00");
});
it("stores the individual appointment slot selected by the customer", async () => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "test"); vi.stubEnv("PAYPAL_CLIENT_SECRET", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ access_token: "test" })).mockResolvedValueOnce(Response.json({ id: "order-test" })));
  await createBookingOrder({ ...input, appointmentSlotId: "22222222-2222-4222-8222-222222222222" }, null);
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ appointment_slot_id: "22222222-2222-4222-8222-222222222222" }));
});