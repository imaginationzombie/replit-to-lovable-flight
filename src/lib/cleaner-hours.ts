const DAY_SHORT: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
export function hoursSummary(wh: unknown): string {
  const h = (wh ?? {}) as Record<string, { on?: boolean; start?: string; end?: string }>;
  const parts = Object.keys(DAY_SHORT).filter((d) => h[d]?.on).map((d) => `${DAY_SHORT[d]} ${h[d]!.start}–${h[d]!.end}`);
  return parts.length ? parts.join(", ") : "No weekly hours set";
}
