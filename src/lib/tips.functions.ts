import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tipAmountSchema } from "./tips";
const access = z.object({ id: z.string().uuid(), token: z.string().uuid() });
export const tipDetails = createServerFn({ method: "GET" }).inputValidator((d: unknown) => access.parse(d)).handler(async ({ data }) => {
  const { getTip } = await import("./tips.server");
  return getTip(data.id, data.token);
});
export const createTip = createServerFn({ method: "POST" }).inputValidator((d: unknown) => access.extend({ amountCents: tipAmountSchema }).parse(d)).handler(async ({ data }) => {
  const { startTip } = await import("./tips.server");
  return startTip(data.id, data.token, data.amountCents);
});
export const captureTip = createServerFn({ method: "POST" }).inputValidator((d: unknown) => access.extend({ orderId: z.string().min(5).max(64) }).parse(d)).handler(async ({ data }) => {
  const { finishTip } = await import("./tips.server");
  return finishTip(data.id, data.token, data.orderId);
});
export const payoutTip = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id: z.string().uuid(), send: z.boolean(), confirmed: z.literal(true) }).parse(d)).handler(async ({ data, context }) => {
  const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !allowed) throw new Error("Only admins can transfer tips.");
  const { transferTip } = await import("./tips.server");
  return transferTip(data.id, data.send);
});