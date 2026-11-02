import { describe, expect, it } from "vitest";
import { matchAddOns, quote } from "@/lib/pricing";

describe("booking price", () => {
  it("2 bed / 1 bath standard clean is $95", () => {
    expect(quote({ service: "Standard Housekeeping", bedrooms: 2, bathrooms: 1, addOns: [], rush: false }).total).toBe(95);
  });
  it("deep clean base is $140", () => {
    expect(quote({ service: "Deep Clean", bedrooms: 1, bathrooms: 1, addOns: [], rush: false }).total).toBe(140);
  });
  it("adds $15 per bedroom over 2 and per bathroom over 1", () => {
    expect(quote({ service: "Standard Housekeeping", bedrooms: 3, bathrooms: 2, addOns: [], rush: false }).total).toBe(125);
  });
  it("charges add-ons at 50% off, plus $15 rush fee, counting each add-on once", () => {
    const q = quote({ service: "Standard Housekeeping", bedrooms: 2, bathrooms: 1, addOns: ["Refrigerator Interior", "Refrigerator Interior", "Eco Pet Odor & Fur"], rush: true });
    expect(q.total).toBe(95 + 17.5 + 12.5 + 15);
    expect(q.totalCents).toBe(14000);
  });
  it("ignores unknown add-ons", () => {
    expect(quote({ service: "Standard Housekeeping", bedrooms: 2, bathrooms: 1, addOns: ["Free Gold"], rush: false }).total).toBe(95);
  });
  it("maps assistant suggestions to real add-ons", () => {
    expect(matchAddOns(["Inside Refrigerator", "Pet Hair Treatment"]).sort()).toEqual(["Eco Pet Odor & Fur", "Refrigerator Interior"]);
  });
});
