import { describe, expect, it } from "vitest";
import { nextVisitDate } from "@/lib/booking.server";

describe("repeat visit scheduling", () => {
  it("weekly adds 7 days", () => expect(nextVisitDate("2026-11-02", "Weekly")).toBe("2026-11-09"));
  it("bi-weekly adds 14 days", () => expect(nextVisitDate("2026-11-25", "Bi-weekly")).toBe("2026-12-09"));
  it("monthly adds one month", () => expect(nextVisitDate("2026-11-15", "Monthly")).toBe("2026-12-15"));
  it("one-time has no next visit", () => expect(nextVisitDate("2026-11-15", "One-time")).toBeNull());
});
