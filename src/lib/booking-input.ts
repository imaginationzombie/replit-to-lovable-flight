import { z } from "zod";
import { ADD_ONS, FREQUENCIES, SERVICE_AREAS, SERVICE_BASE, TIME_WINDOWS, CLEANING_LEVELS } from "./pricing";

export const bookingSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(30),
  address: z.string().trim().min(5).max(300),
  serviceArea: z.enum(SERVICE_AREAS as [string, ...string[]]),
  service: z.string().refine(s => Object.hasOwn(SERVICE_BASE, s)),
  frequency: z.enum(FREQUENCIES as [string, ...string[]]),
  bedrooms: z.number().int().min(1).max(10),
  bathrooms: z.number().int().min(1).max(10),
  addOns: z.array(z.string().refine(a => Object.hasOwn(ADD_ONS, a))).max(12),
  rush: z.boolean(),
  cleaningLevel: z.enum(CLEANING_LEVELS).default("Light"),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeWindow: z.enum(TIME_WINDOWS as [string, ...string[]]),
  notes: z.string().max(1000),
  requestedCleanerId: z.string().uuid().optional(),
  appointmentSlotId: z.string().uuid().optional(),
});
export type BookingFormInput = z.infer<typeof bookingSchema>;
export const customerBookingSchema = bookingSchema.refine(b => Boolean(b.appointmentSlotId && b.requestedCleanerId), { message: "Choose an available appointment." });