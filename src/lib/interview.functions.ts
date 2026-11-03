import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INTERVIEW_TIMES, interviewLabel } from "./hiring";

export const chooseInterviewTime = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.enum(INTERVIEW_TIMES.map(t => t.value) as [string, ...string[]]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("choose_interview_time", { _id: data.id, _date: data.date, _time: data.time });
    if (error) throw new Error(error.message);
    const { data: app } = await context.supabase.from("hiring_applications").select("full_name,phone,interview_date,interview_time").eq("id", data.id).eq("user_id", context.userId).single();
    const email = (context.claims as { email?: string }).email;
    if (!app?.interview_date || !email) return { emailed: false };
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      const date = new Date(`${app.interview_date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
      const result = await sendTemplateEmail("interview-confirmation", email, {
        templateData: { name: app.full_name.split(" ")[0], date, time: interviewLabel(app.interview_time), phone: app.phone },
        idempotencyKey: `interview-confirmation-${data.id}-${app.interview_date}-${app.interview_time}`,
      });
      return { emailed: !!result?.sent };
    } catch (e) { console.error("Interview confirmation email failed", e); return { emailed: false }; }
  });
