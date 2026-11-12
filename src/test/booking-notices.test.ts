import { beforeEach, expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: true }));
vi.mock("../lib/email-templates/send-email", () => ({ sendTemplateEmail: send }));
import { notifyBookingEvent, sendBookingNotice, sendCleanerPaymentNotice, sendOwnerBookingNotice, sendCleanerBookingNotice, sendParticipantConfirmations } from "../lib/booking-notices.server";
import { template as ownerTemplate } from "../lib/email-templates/owner-booking-notification";
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
it("keeps confirmation retry keys ASCII and short for real UUIDs and Eastern arrival windows", async () => {
 await sendBookingNotice(db({ ...booking, id: "472ebb5d-1d5f-4706-a958-c5d1a000f6d8", cleaner_id: "472ebb5d-1d5f-4706-a958-c5d1a000f6d8", time_window: "Morning (8am–12pm)" }), booking.id);
 const key = send.mock.calls[0]?.[2].idempotencyKey;
 expect(key).toMatch(/^booking-confirmation-[a-f0-9]{64}$/);
 expect(key.length).toBeLessThan(128);
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
  send.mockResolvedValueOnce({ sent: true });
  send.mockResolvedValueOnce({ sent: true });
  send.mockRejectedValueOnce(new Error("Email unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(notifyBookingEvent(db(), booking.id, "confirmed")).resolves.toEqual({ sent: false, reason: "send_failed" });
  expect(send).toHaveBeenCalledTimes(3);
  log.mockRestore();
});
it("sends new appointments to the owner's fixed email, not the customer's address", async () => {
  expect(ownerTemplate.to).toBe("chelsealawhead88@gmail.com");
  await sendOwnerBookingNotice(db(), booking.id);
  expect(send).toHaveBeenCalledWith("owner-booking-notification", "", expect.objectContaining({ templateData: expect.objectContaining({ name: "Customer", amount: "$95.00", time: "Morning" }), idempotencyKey: "owner-booking-notification-visit-1" }));
});
it("uses one owner alert key per visit even when its schedule or cleaner changes", async () => {
  await sendOwnerBookingNotice(db(), booking.id);
  await sendOwnerBookingNotice(db({ ...booking, preferred_date: "2026-11-10", cleaner_id: "cleaner-2" }), booking.id);
  expect(send.mock.calls[0]?.[2].idempotencyKey).toBe("owner-booking-notification-visit-1");
  expect(send.mock.calls[1]?.[2].idempotencyKey).toBe("owner-booking-notification-visit-1");
});
it("does not alert the owner about abandoned or cancelled bookings", async () => {
  await sendOwnerBookingNotice(db({ ...booking, status: "pending_payment" }), booking.id);
  await sendOwnerBookingNotice(db({ ...booking, status: "cancelled" }), booking.id);
  expect(send).not.toHaveBeenCalled();
});
it("keeps customer confirmations working if the owner alert fails", async () => {
  send.mockResolvedValueOnce({ sent: true });
  send.mockRejectedValueOnce(new Error("Owner email unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(notifyBookingEvent(db(), booking.id, "confirmed")).resolves.toEqual({ sent: true });
  expect(send.mock.calls.map(call => call[0])).toEqual(["cleaner-booking-confirmation", "owner-booking-notification", "booking-confirmation"]);
  log.mockRestore();
});
it("emails only the assigned housekeeper with exact slot time and saved customer details", async () => {
 await sendCleanerBookingNotice(db({ ...booking, appointment_start: "09:00:00", appointment_end: "11:00:00", phone: "555-0100" } as typeof booking), booking.id);
 expect(send).toHaveBeenCalledWith("cleaner-booking-confirmation", "cleaner@example.com", expect.objectContaining({ templateData: expect.objectContaining({ customer: "Customer", email: "customer@example.com", phone: "555-0100", time: "9:00am–11:00am Eastern", address: "Home" }) }));
});
it("never sends housekeeper customer details for an unconfirmed visit", async () => {
 await sendCleanerBookingNotice(db({ ...booking, status: "pending_payment" }), booking.id);
 expect(send).not.toHaveBeenCalled();
});
it("manual confirmation sends both customer and assigned housekeeper without another owner alert", async () => {
 await expect(sendParticipantConfirmations(db(), booking.id)).resolves.toEqual({ customer: { sent: true }, cleaner: { sent: true } });
 expect(send.mock.calls.map(call => call[0])).toEqual(["booking-confirmation", "cleaner-booking-confirmation"]);
});
it("still attempts the housekeeper confirmation when customer sending fails", async () => {
 send.mockRejectedValueOnce(new Error("Customer send unavailable"));
 const log = vi.spyOn(console, "error").mockImplementation(() => {});
 const result = await sendParticipantConfirmations(db(), booking.id);
 expect(result.customer.sent).toBe(false);
 expect(result.cleaner.sent).toBe(true);
 expect(send.mock.calls[1]?.[1]).toBe("cleaner@example.com");
 log.mockRestore();
});
