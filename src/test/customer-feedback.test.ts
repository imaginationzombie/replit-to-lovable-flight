import { expect, it } from "vitest";
import { canReviewBooking, disputeSchema, resolutionSchema, reviewSchema } from "../lib/customer-feedback";
const id = "11111111-1111-4111-8111-111111111111";
it("supports unpaid and uncleaned reports, but rejects invented issue types", () => {
  for (const kind of ["unpaid", "uncleaned"]) expect(disputeSchema.safeParse({ bookingId: id, kind, details: "The visit needs attention." }).success).toBe(true);
  expect(disputeSchema.safeParse({ bookingId: id, kind: "refund", details: "The visit needs attention." }).success).toBe(false);
});
it("final admin resolution requires an explanation", () => {
  expect(resolutionSchema.safeParse({ status: "resolved", resolution: "" }).success).toBe(false);
  expect(resolutionSchema.safeParse({ status: "resolved", resolution: "A replacement cleaning is scheduled." }).success).toBe(true);
  expect(resolutionSchema.safeParse({ status: "reviewing", resolution: "" }).success).toBe(true);
});
it("invites reviews only for completed assigned visits", () => {
  expect(canReviewBooking({ status: "confirmed", cleaner_id: id })).toBe(false);
  expect(canReviewBooking({ status: "completed", cleaner_id: null })).toBe(false);
  expect(canReviewBooking({ status: "completed", cleaner_id: id })).toBe(true);
});
it("reviews require a public name, written feedback and a one-to-five rating", () => {
  const review = { bookingId: id, rating: 5, body: "My home was cleaned beautifully.", publicName: "Verified customer" };
  expect(reviewSchema.safeParse(review).success).toBe(true);
  expect(reviewSchema.safeParse({ ...review, rating: 6 }).success).toBe(false);
  expect(reviewSchema.safeParse({ ...review, publicName: "" }).success).toBe(false);
});