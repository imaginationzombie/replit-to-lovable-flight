import { expect, it } from "vitest";
import { bookedSlot } from "../lib/housekeeper-dashboard";
const slot = { id: "slot-1", slot_date: "2026-12-01", start_time: "09:00:00", end_time: "11:00:00" };
const booking = { id: "booking-1", appointment_slot_id: "slot-1", preferred_date: "2026-12-01", appointment_start: "09:00:00", appointment_end: "11:00:00", status: "confirmed" };
it("matches a booked slot to its confirmed appointment", () => expect(bookedSlot(slot, [booking])?.id).toBe("booking-1"));
it("does not show cancelled appointments as booked", () => expect(bookedSlot(slot, [{ ...booking, status: "cancelled" }])).toBeUndefined());
it("does not attach client details from a different slot at the same start time", () => expect(bookedSlot(slot, [{ ...booking, appointment_slot_id: "slot-2" }])).toBeUndefined());
it("matches legacy exact appointments only when both times match", () => {
  expect(bookedSlot(slot, [{ ...booking, appointment_slot_id: null }])?.id).toBe("booking-1");
  expect(bookedSlot(slot, [{ ...booking, appointment_slot_id: null, appointment_end: "10:00:00" }])).toBeUndefined();
});