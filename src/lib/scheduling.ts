import { addDays, format, startOfWeek } from "date-fns";

export const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
export const weekDates = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};
export function canMoveJob(isAdmin: boolean, userId: string | undefined, booking: { status: string; cleaner_id: string | null }) {
  return booking.status === "confirmed" && (isAdmin || (!!userId && booking.cleaner_id === userId));
}