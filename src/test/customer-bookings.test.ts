import { describe, expect, it } from "vitest";
import { visitSchedule } from "../lib/customer-bookings";

describe("customer visit schedule", () => {
  it("shows scheduled only for a confirmed assigned cleaner", () => {
    expect(visitSchedule({ status: "confirmed", cleaner_id: "cleaner" })).toBe("Cleaner scheduled");
  });
  it("does not promise a cleaner for an unassigned visit", () => {
    expect(visitSchedule({ status: "confirmed", cleaner_id: null })).toBe("Confirmed · cleaner assignment pending");
  });
  it("does not show a requested time as confirmed", () => {
    expect(visitSchedule({ status: "pending_payment", cleaner_id: "cleaner" })).toBe("Requested time · awaiting confirmation");
  });
  it("does not show cancelled visits as scheduled", () => {
    expect(visitSchedule({ status: "cancelled", cleaner_id: "cleaner" })).toBe("Visit cancelled");
  });
});