import { expect, it } from "vitest";
import { filterStaffBookings } from "../lib/staff-dashboard";
import type { BookingRow } from "../components/BookingCard";
const rows = [
  { id: "phone", status: "pending_payment", created_by_staff: "staff", cleaner_id: null, preferred_date: "2026-11-10" },
  { id: "visit", status: "confirmed", created_by_staff: null, cleaner_id: "cleaner-a", preferred_date: "2026-11-11" },
  { id: "past", status: "completed", cleaner_id: "cleaner-b", preferred_date: "2026-11-09" },
] as BookingRow[];
const filters = { from: "", to: "", cleaner: "all", view: "all" };
it("filters appointment dates inclusively", () => expect(filterStaffBookings(rows, { ...filters, from: "2026-11-10", to: "2026-11-11" }).map(b => b.id)).toEqual(["phone", "visit"]));
it("filters assigned cleaner and unassigned phone requests", () => {
  expect(filterStaffBookings(rows, { ...filters, cleaner: "cleaner-a" }).map(b => b.id)).toEqual(["visit"]);
  expect(filterStaffBookings(rows, { ...filters, cleaner: "unassigned" }).map(b => b.id)).toEqual(["phone"]);
});
it("keeps pending estimates separate from confirmed scheduled visits", () => {
  expect(filterStaffBookings(rows, { ...filters, view: "estimates" }).map(b => b.id)).toEqual(["phone"]);
  expect(filterStaffBookings(rows, { ...filters, view: "scheduled" }).map(b => b.id)).toEqual(["visit"]);
});