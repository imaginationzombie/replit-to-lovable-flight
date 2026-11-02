export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
export type WeeklyHours = Record<(typeof WEEK_DAYS)[number], { on: boolean; start: string; end: string }>;

export function readWeeklyHours(value: unknown): WeeklyHours {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(WEEK_DAYS.map(day => {
    const raw = source[day];
    const slot = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return [day, { on: slot["on"] === true, start: typeof slot["start"] === "string" ? slot["start"] : "08:00", end: typeof slot["end"] === "string" ? slot["end"] : "17:00" }];
  })) as WeeklyHours;
}

export function validateWeeklyHours(hours: WeeklyHours): void {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const day of WEEK_DAYS) {
    const slot = hours[day];
    if (slot.on && (!time.test(slot.start) || !time.test(slot.end) || slot.start >= slot.end)) {
      throw new Error(`${DAY_NAMES[day]}: end time must be after start time.`);
    }
  }
}