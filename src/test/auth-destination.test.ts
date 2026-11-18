import { expect, it } from "vitest";
import { safeAuthDestination } from "../lib/auth-destination";

it("returns housekeepers to their own dashboard after sign-in", () => {
  expect(safeAuthDestination("/cleaner")).toBe("/cleaner");
});
it("keeps applicant and customer destinations", () => {
  expect(safeAuthDestination("/apply")).toBe("/apply");
  expect(safeAuthDestination()).toBe("/account");
});
it("rejects external and disguised redirect destinations", () => {
  for (const value of ["https://example.com", "//example.com", "/\\example.com", "/\nexample.com"]) {
    expect(safeAuthDestination(value)).toBe("/account");
  }
});