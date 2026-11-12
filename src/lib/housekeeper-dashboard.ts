import type { AppointmentSlot } from "./appointment-slots";

type SlotBooking = { appointment_slot_id?: string | null; preferred_date: string; appointment_start?: string | null; appointment_end?: string | null; status: string };
export function bookedSlot<T extends SlotBooking>(slot: AppointmentSlot, bookings: T[]): T | undefined {
  return bookings.find(b => b.status === "confirmed" && b.preferred_date === slot.slot_date && (
    b.appointment_slot_id === slot.id || (!b.appointment_slot_id && b.appointment_start?.slice(0, 5) === slot.start_time.slice(0, 5) && b.appointment_end?.slice(0, 5) === slot.end_time.slice(0, 5))
  ));
}