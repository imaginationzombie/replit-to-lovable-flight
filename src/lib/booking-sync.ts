import type { QueryClient } from "@tanstack/react-query";

export async function refreshBookingViews(queryClient: QueryClient) {
  await Promise.all(["scheduler-bookings", "admin-bookings", "cleaner-jobs", "my-bookings"].map(key =>
    queryClient.invalidateQueries({ queryKey: [key], refetchType: "all" }),
  ));
}