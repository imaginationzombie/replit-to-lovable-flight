import { expect, it } from "vitest";
import { appointmentTasks, earningsCents, canReviewTimesheet } from "../lib/cleaner-work";

it("includes every booked add-on in the appointment to-do list", () => {
  const tasks = appointmentTasks({ service: "Deep Clean", add_ons: ["Oven Degrease", "Refrigerator Interior"] });
  expect(tasks).toContain("Oven Degrease");
  expect(tasks).toContain("Refrigerator Interior");
});
it("calculates logged earnings from hours and the cleaner rate", () => {
  expect(earningsCents(150, 2500)).toBe(6250);
  expect(() => earningsCents(-1, 2500)).toThrow();
});
it("only records payment after approval and with a payment reference", () => {
  expect(canReviewTimesheet("submitted", "paid", "transfer-1")).toBe(false);
  expect(canReviewTimesheet("approved", "paid", "")).toBe(false);
  expect(canReviewTimesheet("approved", "paid", "transfer-1")).toBe(true);
});