import { z } from "zod";

export const hiringDetailsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date.").refine(value => { const date = new Date(value + "T12:00:00Z"); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }, "Choose a valid start date."),
  weeklyHours: z.coerce.number().positive("Enter weekly hours.").max(168).multipleOf(0.01),
  hourlyPay: z.coerce.number().positive("Enter hourly pay.").max(10000).multipleOf(0.01),
});
export function hiringDetailsInput(input: unknown) {
  const values = hiringDetailsSchema.parse(input);
  return { _start_date: values.startDate, _weekly_hours: values.weeklyHours, _hourly_pay_cents: Math.round(values.hourlyPay * 100) };
}