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
  const addOns = [...new Set(input.addOns)].reduce((s, a) => s + (ADD_ONS[a] ?? 0), 0);
  const rush = input.rush ? RUSH_FEE : 0;
  const total = base + rooms + addOns + rush;
  return { base, rooms, addOns, rush, total, totalCents: Math.round(total * 100) };
}

// Map loosely-worded AI add-on suggestions onto real add-on names.
export function matchAddOns(suggested: string[]): string[] {
  const keys = Object.keys(ADD_ONS);
  const out = new Set<string>();
  for (const s of suggested) {
    const l = s.toLowerCase();
    const hit = keys.find((k) => k.toLowerCase().split(/[ &/]+/).some((w) => w.length > 3 && l.includes(w)));
    if (hit) out.add(hit);
  }
  return [...out];
}
