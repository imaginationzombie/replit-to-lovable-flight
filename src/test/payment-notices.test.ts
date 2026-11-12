import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";
const send = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: true }));
vi.mock("../lib/email-templates/send-email", () => ({ sendTemplateEmail: send }));
import { notifyPaymentReceipt, sendCleanerPayoutReceipt, sendCustomerPaymentReceipt, sendCustomerTipReceipt } from "../lib/payment-notices.server";
const booking = { id: "b1", email: "customer@example.com", customer_name: "Customer", paid_at: "2026-11-03", paypal_capture_id: "capture1", amount_cents: 9500, access_token: "token" };
const tip = { id: "t1", booking_id: "b1", cleaner_id: "c1", status: "paid", paid_at: "2026-11-03", paypal_capture_id: "tipcap1", amount_cents: 1500, environment: "live", payout_status: "paid", payout_paid_at: "2026-11-03", paypal_item_id: "tipitem1" };
const payout = { id: "p1", cleaner_id: "c1", work_id: "w1", status: "paid", environment: "live", provider_status: "SUCCESS", paypal_item_id: "item1", amount_cents: 4500 };
const rows = { bookings: booking, booking_tips: tip, cleaner_payouts: payout, appointment_work: { status: "paid", paid_at: "2026-11-03" } };
function db(overrides: Record<string, unknown> = {}) {
  const records: Record<string, unknown> = { ...rows, ...overrides };
  return { from: (table: string) => ({ select: () => ({ eq: () => ({ single: async () => ({ data: records[table], error: null }) }) }) }), auth: { admin: { getUserById: async () => ({ data: { user: { email: "cleaner@example.com" } }, error: null }) } } } as unknown as SupabaseClient<Database>;
}
beforeEach(() => send.mockClear());
it("customer receipt uses saved customer address and capture reference", async () => {
  await sendCustomerPaymentReceipt(db(), "b1");
  expect(send).toHaveBeenCalledWith("customer-payment-receipt", "customer@example.com", expect.objectContaining({ idempotencyKey: "customer-payment-b1-capture1", templateData: expect.objectContaining({ amount: "$95.00", reference: "capture1" }) }));
});
it("unverified customer payments do not get receipts", async () => {
  await sendCustomerPaymentReceipt(db({ bookings: { ...booking, paypal_capture_id: null } }), "b1");
  expect(send).not.toHaveBeenCalled();
});
it("tip capture sends its own saved receipt without crediting cleaner earnings", async () => {
  await sendCustomerTipReceipt(db(), "t1");
  expect(send).toHaveBeenCalledWith("customer-tip-receipt", "customer@example.com", expect.objectContaining({ idempotencyKey: "customer-tip-t1-tipcap1", templateData: expect.objectContaining({ amount: "$15.00" }) }));
});
it("pending tips do not receive paid receipts", async () => {
  await sendCustomerTipReceipt(db({ booking_tips: { ...tip, status: "pending" } }), "t1");
  expect(send).not.toHaveBeenCalled();
});
it("only live successful payout with paid timesheet sends cleaner earnings receipt", async () => {
  await sendCleanerPayoutReceipt(db(), "p1", "work");
  expect(send).toHaveBeenCalledWith("cleaner-payout-receipt", "cleaner@example.com", expect.objectContaining({ idempotencyKey: "cleaner-payout-receipt-p1-item1", templateData: expect.objectContaining({ amount: "$45.00" }) }));
});
it("sandbox payouts cannot imply real settlement", async () => {
  await sendCleanerPayoutReceipt(db({ cleaner_payouts: { ...payout, environment: "sandbox" } }), "p1", "work");
  expect(send).not.toHaveBeenCalled();
});
it("pending payouts cannot imply settlement", async () => {
  await sendCleanerPayoutReceipt(db({ cleaner_payouts: { ...payout, status: "pending", provider_status: "PENDING" } }), "p1", "work");
  expect(send).not.toHaveBeenCalled();
});
it("unsettled timesheets cannot receive payout receipt", async () => {
  await sendCleanerPayoutReceipt(db({ appointment_work: { status: "approved", paid_at: null } }), "p1", "work");
  expect(send).not.toHaveBeenCalled();
});
it("tip settlement sends cleaner account receipt independently from wage receipts", async () => {
  await sendCleanerPayoutReceipt(db(), "t1", "tip");
  expect(send).toHaveBeenCalledWith("cleaner-tip-payout-receipt", "cleaner@example.com", expect.objectContaining({ idempotencyKey: "cleaner-tip-payout-receipt-t1-tipitem1" }));
});
it("email failure cannot fail an already saved payment", async () => {
  send.mockRejectedValueOnce(new Error("Unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(notifyPaymentReceipt(db(), "b1", "customer-payment")).resolves.toEqual({ sent: false, reason: "send_failed" });
  log.mockRestore();
});
it("emails the collected amount with a 24-hour deadline before customer confirmation", async () => {
 await sendCustomerTipReceipt(db({ booking_tips: { ...tip, customer_confirmed_at: null, confirmation_requested_at: "2026-11-12T17:00:00Z", confirmation_expires_at: "2026-11-13T17:00:00Z" } }), "t1");
 expect(send).toHaveBeenCalledWith("tip-confirmation", "customer@example.com", expect.objectContaining({ idempotencyKey: "tip-confirm-t1-2026-11-12T17:00:00Z", templateData: expect.objectContaining({ amount: "$15.00", deadline: "November 13, 2026 at 12:00 PM Eastern" }) }));
});
