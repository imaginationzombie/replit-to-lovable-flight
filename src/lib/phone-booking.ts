import { bookingSchema, type BookingFormInput } from "./booking-input";
import { quote } from "./pricing";

export const phoneBookingSchema = bookingSchema.omit({ requestedCleanerId: true });
export function phoneBookingRow(input: BookingFormInput, staffId: string) {
  return {
    customer_name: input.customerName, email: input.email, phone: input.phone, address: input.address,
    service_area: input.serviceArea, service: input.service, frequency: input.frequency,
    bedrooms: input.bedrooms, bathrooms: input.bathrooms, add_ons: [...new Set(input.addOns)],
    rush: input.rush, cleaning_level: input.cleaningLevel, preferred_date: input.preferredDate,
    time_window: input.timeWindow, notes: input.notes, amount_cents: quote(input).totalCents,
    status: "pending_payment", user_id: null, cleaner_id: null, created_by_staff: staffId,
  };
}
export function canSendPhoneEstimate(isAdmin: boolean, isCleaner: boolean, staffId: string, creatorId: string | null, status: string) {
  return status === "pending_payment" && (isAdmin || (isCleaner && staffId === creatorId));
}
export function validatePhoneDate(date: string, today: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < today) throw new Error("Choose a valid appointment date today or later.");
}