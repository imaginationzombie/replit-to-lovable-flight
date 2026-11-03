import type { BookingRow } from "@/components/BookingCard";
export type StaffFilters = { from: string; to: string; cleaner: string; view: string };
export function filterStaffBookings(rows: BookingRow[], filters: StaffFilters) {
  return rows.filter(b => (!filters.from || b.preferred_date >= filters.from) && (!filters.to || b.preferred_date <= filters.to)
    && (!filters.cleaner || filters.cleaner === "all" || (filters.cleaner === "unassigned" ? !b.cleaner_id : b.cleaner_id === filters.cleaner))
    && (filters.view === "phone" ? Boolean(b.created_by_staff) : filters.view === "estimates" ? b.status === "pending_payment" && Boolean(b.created_by_staff) : filters.view === "scheduled" ? b.status === "confirmed" : true));
}