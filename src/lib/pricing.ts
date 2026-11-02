// Prices mirror the home page calculator. Used on both the form (display) and server (charged amount).
export const SERVICE_BASE: Record<string, number> = {
  "Standard Housekeeping": 95,
  "Deep Clean": 140,
  "Move-In / Move-Out Turnover": 140,
  "Commercial Office": 95,
  "Fall & Seasonal Property Care": 95,
};

export const ADD_ONS: Record<string, number> = {
  "Refrigerator Interior": 35,
  "Oven Degrease": 35,
  "Window Detailing": 30,
  "Baseboards & Blinds": 25,
  "Cabinet Interiors": 30,
  "Patio & Porch Sweep": 20,
  "Eco Pet Odor & Fur": 25,
  "Dishwasher Descale": 15,
  "Hardwood Floor Buff": 35,
  "Microwave & Hood": 20,
  "Linen Bed Dressing": 15,
  "Grout & Scale Descale": 30,
};

/** Add-on promotion: 0.5 = 50% off every add-on. */
export const ADD_ON_DISCOUNT = 0.5;
export const addOnPrice = (name: string) => (ADD_ONS[name] ?? 0) * (1 - ADD_ON_DISCOUNT);

/** Base cleaning minutes per service (matches the home calculator's 2-hr / 3-hr packages). */
export const SERVICE_MINUTES: Record<string, number> = {
  "Standard Housekeeping": 120,
  "Deep Clean": 180,
  "Move-In / Move-Out Turnover": 180,
  "Commercial Office": 120,
  "Fall & Seasonal Property Care": 120,
};
export const ROOM_MINUTES = 15;

/** One add-on is included free for every full hour of base cleaning time (add-on time not counted). Most expensive ones are free first. */
export function includedAddOns(input: { service: string; bedrooms: number; bathrooms: number; addOns: string[] }) {
  const mins = SERVICE_MINUTES[input.service] ?? 0; // extra rooms are charged, they do not add free add-ons
  const hours = Math.floor(mins / 60);
  const picked = [...new Set(input.addOns)].filter((a) => a in ADD_ONS).sort((a, b) => ADD_ONS[b]! - ADD_ONS[a]! || a.localeCompare(b));
  return { hours, free: picked.slice(0, hours), paid: picked.slice(hours) };
}

export const RUSH_FEE = 15;
export const ROOM_SURCHARGE = 15;

export const SERVICE_AREAS = [
  "DuBois & Sandy Twp",
  "Brookville",
  "Punxsutawney",
  "Reynoldsville",
  "Sykesville",
  "Falls Creek / Brockway",
];

export const TIME_WINDOWS = ["Morning (8am–12pm)", "Afternoon (12pm–4pm)", "Evening (4pm–7pm)"];
export const FREQUENCIES = ["One-time", "Weekly", "Bi-weekly", "Monthly"];

export function quote(input: { service: string; bedrooms: number; bathrooms: number; addOns: string[]; rush: boolean }) {
  const base = SERVICE_BASE[input.service] ?? 0;
  const rooms = Math.max(0, input.bedrooms - 2) * ROOM_SURCHARGE + Math.max(0, input.bathrooms - 1) * ROOM_SURCHARGE;
  const inc = includedAddOns(input);
  const addOns = inc.paid.reduce((s, a) => s + addOnPrice(a), 0);
  const rush = input.rush ? RUSH_FEE : 0;
  const total = base + rooms + addOns + rush;
  return { base, rooms, addOns, rush, total, totalCents: Math.round(total * 100), includedHours: inc.hours, freeAddOns: inc.free };
}

// Map loosely-worded AI add-on suggestions onto real add-on names.
export function matchAddOns(suggested: string[]): string[] {
  const keys = Object.keys(ADD_ONS);
  const out = new Set<string>();
  for (const s of suggested) {
    const l = s.toLowerCase();
    const hit = keys.find((k) => k.toLowerCase().split(/[ &/]+/).some((w) => w.length >= 3 && l.includes(w)));
    if (hit) out.add(hit);
  }
  return [...out];
}
