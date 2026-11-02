export function canPayBooking(booking: { status: string; paid_at?: string | null; access_token?: string }) {
  return booking.status === "completed" && !booking.paid_at && Boolean(booking.access_token);
}