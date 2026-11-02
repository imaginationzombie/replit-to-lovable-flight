import type { BookingRow } from "@/components/BookingCard";

export function appointmentTasks(booking: Pick<BookingRow, "service" | "add_ons">) {
  return [...new Set([
    "Kitchen surfaces and sink", "Bathrooms and fixtures", "Dust surfaces", "Vacuum and mop floors", "Empty bins", "Final walkthrough",
    ...(booking.service === "Deep Clean" ? ["Detail edges and hard-to-reach surfaces"] : []),
    ...booking.add_ons,
  ])];
}

export function earningsCents(minutes: number, rateCents: number) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440 || !Number.isInteger(rateCents) || rateCents < 0) throw new Error("Enter valid hours and rate.");
  return Math.round(minutes * rateCents / 60);
}

export function canReviewTimesheet(status: string, action: string, reference = "") {
  return (status === "submitted" && (action === "approve" || action === "return")) || (status === "approved" && action === "paid" && reference.trim().length > 0 && reference.trim().length <= 200);
}