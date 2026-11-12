import { beforeEach, afterEach, expect, it, vi } from "vitest";
type RecordRow = Record<string, unknown> & { status?: string; paypal_capture_id?: string; paid_at?: string | null };
const mocks = vi.hoisted(() => ({ notice: vi.fn().mockResolvedValue({ sent: true }), row: {} as RecordRow, writes: [] as RecordRow[] }));
vi.mock("../lib/booking-notices.server", () => ({ notifyBookingEvent: mocks.notice }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => {
    const query = { select: () => query, eq: () => query, single: async () => ({ data: mocks.row, error: null }), update: (patch: Record<string, unknown>) => { mocks.writes.push(patch); Object.assign(mocks.row, patch); return query; }, then: (resolve: (value: unknown) => void) => resolve({ error: null }) };
    return query;
  },
} }));
import { authorizeBookingOrder, captureBookingOrder, collectBookingPayment } from "../lib/booking.server";
beforeEach(() => {
  mocks.notice.mockClear(); mocks.writes.length = 0;
  mocks.row = { id: "booking-1", access_token: "token", status: "pending_payment", amount_cents: 9500, paypal_authorization_id: "auth-1", paid_at: null };
  vi.stubEnv("PAYPAL_CLIENT_ID", "test-client"); vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-secret");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function paypal(receipt: unknown) {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "test-token" })).mockResolvedValueOnce(Response.json(receipt));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
it("checkout confirmation sends the customer email only after saving confirmation", async () => {
  paypal({ purchase_units: [{ payments: { authorizations: [{ id: "auth-1", status: "CREATED", amount: { value: "95.00", currency_code: "USD" } }] } }] });
  await authorizeBookingOrder("order-1");
  expect(mocks.writes[0]?.status).toBe("confirmed");
  expect(mocks.notice).toHaveBeenCalledWith(expect.anything(), "booking-1", "confirmed");
  expect(mocks.notice).not.toHaveBeenCalledWith(expect.anything(), "booking-1", "paid");
});
it("customer balance capture sends the assigned-cleaner payment notice", async () => {
  mocks.row.status = "completed";
  paypal({ status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "capture-1", status: "COMPLETED", amount: { value: "95.00", currency_code: "USD" } }] } }] });
  await captureBookingOrder("order-1");
  expect(mocks.writes[0]?.paypal_capture_id).toBe("capture-1");
  expect(mocks.notice).toHaveBeenCalledWith(expect.anything(), "booking-1", "paid");
});
it("post-cleaning authorization collection sends the cleaner receipt", async () => {
  mocks.row.status = "completed";
  paypal({ id: "capture-1", status: "COMPLETED", amount: { value: "95.00", currency_code: "USD" } });
  await expect(collectBookingPayment("booking-1")).resolves.toMatchObject({ paid: true });
  expect(mocks.notice).toHaveBeenCalledWith(expect.anything(), "booking-1", "paid");
});
it("pending PayPal money is not marked paid or emailed as received", async () => {
  mocks.row.status = "completed";
  paypal({ id: "capture-1", status: "PENDING" });
  await expect(collectBookingPayment("booking-1")).resolves.toEqual({ paid: false, needsCustomerPayment: false });
  expect(mocks.writes).toEqual([{ payment_checkout_started: true }]);
  expect(mocks.row.paid_at).toBeNull();
  expect(mocks.notice).not.toHaveBeenCalled();
});
it("a receipt with the wrong amount cannot trigger a payment confirmation", async () => {
  mocks.row.status = "completed";
  paypal({ id: "capture-1", status: "COMPLETED", amount: { value: "9.50", currency_code: "USD" } });
  await expect(collectBookingPayment("booking-1")).rejects.toThrow("amount didn't match");
  expect(mocks.notice).not.toHaveBeenCalled();
});
it("retrying a paid visit retries only the idempotent notice, not the PayPal charge", async () => {
  mocks.row.status = "completed"; mocks.row.paid_at = "2026-11-02";
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await collectBookingPayment("booking-1");
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.notice).toHaveBeenCalledWith(expect.anything(), "booking-1", "paid");
});
it("captures only the remaining $45 after a $50 certificate on a $95 cleaning", async () => {
 mocks.row.status = "completed"; mocks.row["gift_credit_cents"] = 5000;
 const fetch = paypal({ id: "capture-1", status: "COMPLETED", amount: { value: "45.00", currency_code: "USD" } });
 await expect(collectBookingPayment("booking-1")).resolves.toMatchObject({ paid: true });
 const body = JSON.parse(fetch.mock.calls[1]?.[1].body);
 expect(body.amount).toEqual({ value: "45.00", currency_code: "USD" });
});