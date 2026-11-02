import { describe, expect, it } from "vitest";
import { canMoveJob, dateKey, weekDates } from "../lib/scheduling";

describe("scheduler", () => {
  it("lets admins move confirmed jobs", () => expect(canMoveJob(true, "admin", { status: "confirmed", cleaner_id: "other" })).toBe(true));
  it("lets employees move their assigned jobs", () => expect(canMoveJob(false, "employee", { status: "confirmed", cleaner_id: "employee" })).toBe(true));
  it("does not let employees move someone else's jobs", () => expect(canMoveJob(false, "employee", { status: "confirmed", cleaner_id: "other" })).toBe(false));
  it("does not move completed visits", () => expect(canMoveJob(true, "admin", { status: "completed", cleaner_id: null })).toBe(false));
  it("starts weeks on Monday across month boundaries", () => expect(weekDates(new Date(2026, 10, 1)).map(dateKey)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]));
});