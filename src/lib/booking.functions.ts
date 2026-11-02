import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADD_ONS, FREQUENCIES, SERVICE_AREAS, SERVICE_BASE, TIME_WINDOWS } from "./pricing";

const bookingSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(30),
  address: z.string().trim().min(5).max(300),
  serviceArea: z.enum(SERVICE_AREAS as [string, ...string[]]),
  service: z.string().refine((s) => s in SERVICE_BASE),
  frequency: z.enum(FREQUENCIES as [string, ...string[]]),
  bedrooms: z.number().int().min(1).max(10),
  bathrooms: z.number().int().min(1).max(10),
  addOns: z.array(z.string().refine((a) => a in ADD_ONS)).max(12),
  rush: z.boolean(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeWindow: z.enum(TIME_WINDOWS as [string, ...string[]]),
  notes: z.string().max(1000),
});

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Something went wrong." });

export const getPaypalConfig = createServerFn({ method: "GET" }).handler(async (): Promise<Result<{ clientId: string }>> => {
  const { paypalClientId } = await import("./booking.server");
  try { return { ok: true, data: { clientId: paypalClientId() } }; } catch (e) { return fail(e); }
});

export const createOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ orderId: string }>> => {
    const { createBookingOrder } = await import("./booking.server");
    try { return { ok: true, data: await createBookingOrder(data) }; } catch (e) { return fail(e); }
  });

export const captureOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ orderId: z.string().min(5).max(64) }).parse(d))
  .handler(async ({ data }): Promise<Result<{ bookingId: string; token: string }>> => {
    const { captureBookingOrder } = await import("./booking.server");
    try { return { ok: true, data: await captureBookingOrder(data.orderId) }; } catch (e) { return fail(e); }
  });

export const fetchBooking = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ id: z.string().uuid(), token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getBooking } = await import("./booking.server");
    return getBooking(data.id, data.token);
  });
