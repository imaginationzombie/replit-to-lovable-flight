import { expect, it } from "vitest";
import { hiringDetailsInput } from "../lib/hiring-details";

it("keeps the selected start date", () => {
  expect(hiringDetailsInput({ startDate: "2026-12-01", weeklyHours: 20, hourlyPay: 25 })._start_date).toBe("2026-12-01");
  expect(() => hiringDetailsInput({ startDate: "2026-02-30", weeklyHours: 20, hourlyPay: 25 })).toThrow();
});
it("stores weekly hours independently of worked timesheets", () => {
  expect(hiringDetailsInput({ startDate: "2026-12-01", weeklyHours: 24.5, hourlyPay: 25 })._weekly_hours).toBe(24.5);
  expect(() => hiringDetailsInput({ startDate: "2026-12-01", weeklyHours: 0, hourlyPay: 25 })).toThrow();
});
it("stores hourly pay as exact cents", () => {
  expect(hiringDetailsInput({ startDate: "2026-12-01", weeklyHours: 20, hourlyPay: 22.75 })._hourly_pay_cents).toBe(2275);
  expect(() => hiringDetailsInput({ startDate: "2026-12-01", weeklyHours: 20, hourlyPay: 0 })).toThrow();
});