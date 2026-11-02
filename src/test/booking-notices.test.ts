import { beforeEach, expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: true }));
vi.mock("../lib/email-templates/send-email", () => ({ sendTemplateEmail: send }));
import { notifyBookingEvent, sendBookingNotice, sendCleanerPaymentNotice } from "../lib/booking-notices.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";

const booking = { id: "visit-1", status: "confirmed", email: "customer@example.com", customer_name: "Customer", service: "Standard", preferred_date: "2026-11-09", time_window: "Morning", address: "Home", frequency: "One-time", cleaner_id: "cleaner-1", access_token: "token", amount_cents: 9500, paid_at: null as string | null, paypal_capture_id: null as string | null };
function db(row = booking) {
  const client = { from: (table: string) => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }), maybeSingle: async () => ({ data: table === "profiles" ? { full_name: "Cleaner" } : row, error: null }) }) }) }), auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "cleaner@example.com" } }, error: null }) } } };
  return client as unknown as SupabaseClient<Database>;
}
beforeEach(() => send.mockClear());
it("sends customer booking details after confirmation, with a stable retry key", async () => {
  await sendBookingNotice(db(), booking.id);
  await sendBookingNotice(db(), booking.id);
  expect(send.mock.calls[0]?.slice(0, 2)).toEqual(["booking-confirmation", "customer@example.com"]);
  expect(send.mock.calls[0]?.[2].templateData).toMatchObject({ time: "Morning", cleaner: "Cleaner", paid: false });
  expect(send.mock.calls[0]?.[2].idempotencyKey).toBe(send.mock.calls[1]?.[2].idempotencyKey);
});
it("does not email abandoned or cancelled bookings", async () => {
  await sendBookingNotice(db({ ...booking, status: "pending_payment" }), booking.id);
  await sendBookingNotice(db({ ...booking, status: "cancelled" }), booking.id);
  expect(send).not.toHaveBeenCalled();
});
it("sends the assigned cleaner the verified customer amount, not their payout address", async () => {
  await sendCleanerPaymentNotice(db({ ...booking, paid_at: "2026-11-09", paypal_capture_id: "capture-1" }), booking.id);
  expect(send).toHaveBeenCalledWith("cleaner-payment-confirmation", "cleaner@example.com", expect.objectContaining({ templateData: expect.objectContaining({ amount: "$95.00", reference: "capture-1" }), idempotencyKey: "cleaner-payment-visit-1-capture-1-cleaner-1" }));
});
it("does not send a cleaner receipt for unpaid or unassigned appointments", async () => {
  await sendCleanerPaymentNotice(db(), booking.id);
  await sendCleanerPaymentNotice(db({ ...booking, cleaner_id: "", paid_at: "2026-11-09", paypal_capture_id: "capture-1" }), booking.id);
  expect(send).not.toHaveBeenCalled();
});
it("does not turn successful booking or payment into failure when email sending fails", async () => {
  send.mockRejectedValueOnce(new Error("Email unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(notifyBookingEvent(db(), booking.id, "confirmed")).resolves.toEqual({ sent: false, reason: "send_failed" });
  expect(send).toHaveBeenCalledTimes(1);
  log.mockRestore();
});