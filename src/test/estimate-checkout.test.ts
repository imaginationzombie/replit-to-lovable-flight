import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ row: null as null | { id: string; status: string; service: string; amount_cents: number; frequency: string; preferred_date: string }, filters: [] as [string, unknown][] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  const q = { select: () => q, eq: (key: string, value: unknown) => { mocks.filters.push([key, value]); return q; }, maybeSingle: async () => ({ data: mocks.row }), update: () => q, then: (resolve: (value: unknown) => void) => resolve({ error: null }) };
  return q;
} } }));
vi.mock("../lib/booking-notices.server", () => ({ notifyBookingEvent: vi.fn() }));
import { createPendingBookingOrder } from "../lib/booking.server";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); mocks.row = null; mocks.filters = []; });
it("requires the matching booking token before opening PayPal", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(createPendingBookingOrder("booking-id", "wrong-token")).rejects.toThrow("not found");
  expect(mocks.filters).toContainEqual(["access_token", "wrong-token"]);
  expect(fetch).not.toHaveBeenCalled();
});
it("authorizes the saved estimate amount without charging or creating a second booking", async () => {
  mocks.row = { id: "booking-id", status: "pending_payment", service: "Standard Housekeeping", amount_cents: 13500, frequency: "One-time", preferred_date: "2099-11-10" };
  vi.stubEnv("PAYPAL_CLIENT_ID", "test"); vi.stubEnv("PAYPAL_CLIENT_SECRET", "test");
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "test" })).mockResolvedValueOnce(Response.json({ id: "test-order" }));
  vi.stubGlobal("fetch", fetch);
  expect(await createPendingBookingOrder("booking-id", "valid-token")).toEqual({ orderId: "test-order" });
  const order = JSON.parse(fetch.mock.calls[1]?.[1]?.body ?? "{}");
  expect(order.intent).toBe("AUTHORIZE");
  expect(order.purchase_units[0]).toMatchObject({ reference_id: "booking-id", amount: { value: "135.00", currency_code: "USD" } });
});