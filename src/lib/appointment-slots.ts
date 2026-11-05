export type AppointmentSlot = { id: string; slot_date: string; start_time: string; end_time: string };
export function slotTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${(hour ?? 0) % 12 || 12}:${String(minute ?? 0).padStart(2, "0")}${(hour ?? 0) < 12 ? "am" : "pm"}`;
}
export function slotLabel(slot: { start_time: string; end_time: string }) {
  return `${slotTime(slot.start_time)}–${slotTime(slot.end_time)} Eastern`;
}
export function slotWindow(start: string) {
  return start < "12:00" ? "Morning (8am–12pm)" : start < "16:00" ? "Afternoon (12pm–4pm)" : "Evening (4pm–7pm)";
}
export function validateSlot(start: string, end: string) {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(start) || !time.test(end) || start >= end) throw new Error("End time must be after start time.");
}