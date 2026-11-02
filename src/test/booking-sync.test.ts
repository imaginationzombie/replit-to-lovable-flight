import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { refreshBookingViews } from "../lib/booking-sync";

it("refreshes inactive admin, cleaner, customer and scheduler lists after a move", async () => {
  const client = new QueryClient();
  const keys = [["admin-bookings"], ["cleaner-jobs", "employee"], ["scheduler-bookings", true, "admin"], ["my-bookings"], ["waiting-list", "employee"]];
  let current = { cleaner_id: null as string | null, preferred_date: "2026-11-03" };
  for (const queryKey of keys) await client.fetchQuery({ queryKey, queryFn: async () => ({ ...current }) });
  current = { cleaner_id: "employee", preferred_date: "2026-11-04" };
  await refreshBookingViews(client);
  for (const key of keys) expect(client.getQueryData(key)).toEqual({ cleaner_id: "employee", preferred_date: "2026-11-04" });
  client.clear();
});