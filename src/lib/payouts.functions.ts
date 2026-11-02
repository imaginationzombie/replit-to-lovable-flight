import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const payoutConfig = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const { payoutEnvironment, payoutsConfigured } = await import("./payouts.server");
  return { environment: payoutEnvironment(), configured: payoutsConfigured() };
});
export const sendCleanerPayout = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workId: z.string().uuid(), recipient: z.string().email(), amountCents: z.number().int().positive(), confirmed: z.literal(true) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !allowed) throw new Error("Only admins can transfer cleaner earnings.");
    const { payoutEnvironment, transferPayout } = await import("./payouts.server");
    const { data: account } = await context.supabase.from("appointment_work").select("cleaner_id,amount_cents").eq("id", data.workId).single();
    if (!account || account.amount_cents !== data.amountCents) throw new Error("Approved earnings changed. Refresh before paying.");
    const { data: recipient } = await context.supabase.from("cleaner_payout_accounts").select("paypal_email").eq("user_id", account.cleaner_id).single();
    if (recipient?.paypal_email !== data.recipient) throw new Error("The receiving email changed. Refresh before paying.");
    const { data: payout, error: reserveError } = await context.supabase.rpc("reserve_cleaner_payout", { _work_id: data.workId, _environment: payoutEnvironment() });
    if (reserveError || !payout) throw new Error(reserveError?.message ?? "Could not reserve payment.");
    return { message: await transferPayout(payout, true) };
  });
export const checkCleanerPayout = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: payout, error } = await context.supabase.from("cleaner_payouts").select("*").eq("id", data.id).single();
    if (error || !payout) throw new Error("Transfer not found or access denied.");
    const { transferPayout } = await import("./payouts.server");
    return { message: await transferPayout(payout, false) };
  });