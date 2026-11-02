import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BookingRow } from "@/components/BookingCard";

export function mergeCustomerBookings(owned: BookingRow[], byEmail: BookingRow[]) {
  return [...new Map([...owned, ...byEmail].map(booking => [booking.id, booking])).values()]
    .sort((a, b) => a.preferred_date.localeCompare(b.preferred_date) || a.created_at.localeCompare(b.created_at));
}

export const customerBookingsOptions = queryOptions({
  queryKey: ["my-bookings"],
  refetchInterval: 15000,
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error("Please sign in to view your bookings.");
    const user = auth.user;
    const ownedRequest = supabase.from("bookings").select("*").eq("user_id", user.id);
    const email = user.email?.replace(/[\\%_]/g, char => `\\${char}`);
    const [owned, byEmail] = await Promise.all([
      ownedRequest,
      email && user.email_confirmed_at
        ? supabase.from("bookings").select("*").ilike("email", email)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (owned.error) throw owned.error;
    if (byEmail.error) throw byEmail.error;
    return mergeCustomerBookings(owned.data as BookingRow[], byEmail.data as BookingRow[]);
  },
});

export function visitSchedule(booking: Pick<BookingRow, "status" | "cleaner_id">): string {
  if (booking.status === "cancelled") return "Visit cancelled";
  if (booking.status === "completed") return "Cleaning completed";
  if (booking.status !== "confirmed") return "Requested time · awaiting confirmation";
  return booking.cleaner_id ? "Cleaner scheduled" : "Confirmed · cleaner assignment pending";
}