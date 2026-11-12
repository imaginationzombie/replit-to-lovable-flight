import { expect, it } from "vitest";
import { validateSlot, slotWindow } from "../lib/appointment-slots";
import { customerBookingSchema } from "../lib/booking-input";
it("requires customers to select an available cleaner appointment", () => {
 const input = { customerName: "Test Client", email: "test@example.com", phone: "5550000000", address: "Test address", serviceArea: "Lewistown, PA", service: "Standard Housekeeping", frequency: "One-time", bedrooms: 2, bathrooms: 1, addOns: [], rush: false, preferredDate: "2026-12-21", timeWindow: "Evening (4pm–7pm)", notes: "" };
 expect(customerBookingSchema.safeParse(input).success).toBe(false);
 expect(customerBookingSchema.safeParse({ ...input, requestedCleanerId: "11111111-1111-4111-8111-111111111111", appointmentSlotId: "22222222-2222-4222-8222-222222222222" }).success).toBe(true);
});
it("permits individual appointments outside standard arrival windows", () => { expect(() => validateSlot("06:00", "07:30")).not.toThrow(); expect(() => validateSlot("21:00", "23:00")).not.toThrow(); });
it("requires an appointment end after its start", () => { expect(() => validateSlot("11:00", "10:00")).toThrow(); expect(() => validateSlot("11:00", "11:00")).toThrow(); });
it("maps exact appointments to the existing schedule window without changing exact times", () => { expect(slotWindow("09:30")).toBe("Morning (8am–12pm)"); expect(slotWindow("13:30")).toBe("Afternoon (12pm–4pm)"); expect(slotWindow("18:30")).toBe("Evening (4pm–7pm)"); });