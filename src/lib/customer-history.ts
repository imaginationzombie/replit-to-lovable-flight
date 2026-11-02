import { queryOptions } from "@tanstack/react-query";
import type { BookingRow } from "@/components/BookingCard";
import { fetchCustomerBookings } from "./customer-bookings";
import { tipDetails } from "./tips.functions";

export type TipReceipt = {
  amount_cents: number; status: string; environment: string;
  paid_at: string | null; payout_status: string; payout_paid_at: string | null;
};

export function cleaningSettlement(booking: Pick<BookingRow, "paid_at" | "status">) {
  if (booking.paid_at) return { status: "settled", date: booking.paid_at };
  return { status: booking.status === "cancelled" ? "cancelled" : booking.status === "completed" ? "due" : "not_charged", date: null };
}

export function tipSettlement(tip: TipReceipt) {
  const received = tip.status === "paid" && !!tip.paid_at;
  return {
    test: tip.environment !== "live",
    collectedAt: received ? tip.paid_at : null,
    deliveredAt: received && tip.environment === "live" && tip.payout_status === "paid" ? tip.payout_paid_at : null,
  };
}

export const customerHistoryOptions = queryOptions({
  queryKey: ["my-bookings", "history"],
  refetchInterval: 15000,
  queryFn: async () => {
    const bookings = await fetchCustomerBookings();
    return Promise.all(bookings.slice().reverse().map(async booking => ({
      booking,
      tip: booking.access_token ? await tipDetails({ data: { id: booking.id, token: booking.access_token } }) : null,
    })));
  },
});