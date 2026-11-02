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
  it("includes 1 free add-on per hour (most expensive first), rest 50% off, plus $15 rush fee, counting each add-on once", () => {
    // Standard = 2 hrs → 2 free add-ons; third (cheapest) is 50% off.
    const q = quote({ service: "Standard Housekeeping", bedrooms: 2, bathrooms: 1, addOns: ["Refrigerator Interior", "Refrigerator Interior", "Eco Pet Odor & Fur", "Dishwasher Descale"], rush: true });
    expect(q.freeAddOns).toEqual(["Refrigerator Interior", "Eco Pet Odor & Fur"]);
    expect(q.total).toBe(95 + 7.5 + 15);
    expect(q.totalCents).toBe(11750);
  });
  it("ignores unknown add-ons", () => {
    expect(quote({ service: "Standard Housekeeping", bedrooms: 2, bathrooms: 1, addOns: ["Free Gold"], rush: false }).total).toBe(95);
  });
  it("maps assistant suggestions to real add-ons", () => {
    expect(matchAddOns(["Inside Refrigerator", "Pet Hair Treatment"]).sort()).toEqual(["Eco Pet Odor & Fur", "Refrigerator Interior"]);
  });
  it("a 3-hour deep clean includes 3 add-ons", () => {
    expect(quote({ service: "Deep Clean", bedrooms: 1, bathrooms: 1, addOns: ["Oven Degrease", "Window Detailing", "Cabinet Interiors"], rush: false }).total).toBe(140);
  });
  it("extra rooms add 15 min each toward the next free add-on", () => {
    // 120 + 4 rooms × 15 = 180 min → 3 free
    expect(quote({ service: "Standard Housekeeping", bedrooms: 4, bathrooms: 3, addOns: ["Oven Degrease", "Window Detailing", "Cabinet Interiors"], rush: false }).freeAddOns.length).toBe(3);
  });
});
