import { addDays, format, startOfWeek } from "date-fns";

export const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
export const weekDates = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};
export function isPhoneRequest(booking: { status: string; created_by_staff?: string | null }) {
  return booking.status === "pending_payment" && Boolean(booking.created_by_staff);
}
export function canMoveJob(isAdmin: boolean, userId: string | undefined, booking: { status: string; cleaner_id: string | null; created_by_staff?: string | null }) {
  if (isPhoneRequest(booking)) return isAdmin || (Boolean(userId) && booking.created_by_staff === userId);
  return booking.status === "confirmed" && (isAdmin || (!!userId && booking.cleaner_id === userId));
}