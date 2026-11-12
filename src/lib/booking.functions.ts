import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bookingSchema } from "./booking-input";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Something went wrong." });

export const getPaypalConfig = createServerFn({ method: "GET" }).handler(async (): Promise<Result<{ clientId: string }>> => {
  const { paypalClientId } = await import("./booking.server");
  try { return { ok: true, data: { clientId: paypalClientId() } }; } catch (e) { return fail(e); }
});

export const createOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => bookingSchema.refine(b => Boolean(b.appointmentSlotId && b.requestedCleanerId), { message: "Choose an available appointment." }).parse(d))
  .handler(async ({ data }): Promise<Result<{ orderId: string }>> => {
    const { createBookingOrder, userIdFromBearer } = await import("./booking.server");
    try {
      const userId = await userIdFromBearer(getRequestHeader("authorization"));
      return { ok: true, data: await createBookingOrder(data, userId, getRequestHeader("origin") ?? "") };
    } catch (e) { return fail(e); }
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

export const authorizeOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ orderId: z.string().min(5).max(64) }).parse(d))
  .handler(async ({ data }): Promise<Result<{ bookingId: string; token: string }>> => {
    const { authorizeBookingOrder } = await import("./booking.server");
    try { return { ok: true, data: await authorizeBookingOrder(data.orderId) }; } catch (e) { return fail(e); }
  });

export const collectPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ paid: boolean; needsCustomerPayment: boolean }>> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { ok: false, error: "Only admins can charge customers." };
    const { collectBookingPayment } = await import("./booking.server");
    try { return { ok: true, data: await collectBookingPayment(data.bookingId) }; } catch (e) { return fail(e); }
  });

export const createBalance = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid(), token: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<Result<{ orderId: string }>> => {
    const { createBalanceOrder } = await import("./booking.server");
    try { return { ok: true, data: await createBalanceOrder(data.id, data.token) }; } catch (e) { return fail(e); }
  });

export const resumeBookingCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), token: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<Result<{ orderId: string }>> => {
    const { createPendingBookingOrder } = await import("./booking.server");
    try { return { ok: true, data: await createPendingBookingOrder(data.id, data.token) }; } catch (e) { return fail(e); }
  });

/** Admin or the assigned cleaner marks a visit done: charges it and schedules the next repeat visit. */
export const completeBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ paid: boolean; needsCustomerPayment: boolean; nextDate: string | null }>> => {
    // RLS: admins see all bookings, cleaners only their assigned ones.
    const { data: visible } = await context.supabase.from("bookings").select("id, cleaner_id").eq("id", data.bookingId).maybeSingle();
    if (!visible) return { ok: false, error: "Booking not found." };
    const [{ data: isAdmin }, { data: isCleaner }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "cleaner" }),
    ]);
    if (!isAdmin && !(isCleaner && visible.cleaner_id === context.userId)) return { ok: false, error: "Not allowed." };
    const { completeVisit } = await import("./booking.server");
    try { return { ok: true, data: await completeVisit(data.bookingId) }; } catch (e) { return fail(e); }
  });
