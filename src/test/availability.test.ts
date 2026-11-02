import { describe, expect, it } from "vitest";
import { readWeeklyHours, validateWeeklyHours } from "../lib/availability";

describe("appointment availability", () => {
  it("preserves saved appointment hours", () => {
    const hours = readWeeklyHours({ mon: { on: true, start: "09:00", end: "14:30" } });
    expect(hours.mon).toEqual({ on: true, start: "09:00", end: "14:30" });
    expect(hours.tue.on).toBe(false);
  });
  it("rejects an end time before the start", () => {
    const hours = readWeeklyHours({ mon: { on: true, start: "14:00", end: "09:00" } });
    expect(() => validateWeeklyHours(hours)).toThrow("Monday: end time must be after start time.");
  });
  it("rejects a zero-length appointment window", () => {
    expect(() => validateWeeklyHours(readWeeklyHours({ tue: { on: true, start: "09:00", end: "09:00" } }))).toThrow();
  });
  it("allows days off without an appointment window", () => {
    expect(() => validateWeeklyHours(readWeeklyHours({ wed: { on: false, start: "", end: "" } }))).not.toThrow();
  });
});