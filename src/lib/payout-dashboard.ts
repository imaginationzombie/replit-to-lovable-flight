import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export type PaymentGroup = "approved" | "pending" | "settled" | "review" | "recorded" | "test";
export function paymentGroup(work: { status: string; paid_at: string | null }, transfer?: { environment: string; status: string } | null): PaymentGroup {
  if (transfer?.environment === "sandbox") return "test";
  if (transfer?.status === "paid") return work.status === "paid" && !!work.paid_at ? "settled" : "review";
  if (transfer && ["failed", "needs_review"].includes(transfer.status)) return "review";
  if (transfer) return "pending";
  return work.status === "paid" ? "recorded" : "approved";
}
export const payoutDashboardOptions = queryOptions({
  queryKey: ["payout-dashboard"], refetchInterval: 15000,
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Please sign in.");
    const { data: admin, error: roleError } = await supabase.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    if (roleError || !admin) throw new Error("Admin access required.");
    const [work, transfers, accounts, cleaners] = await Promise.all([
      supabase.from("appointment_work").select("*,bookings(service,preferred_date,time_window)").in("status", ["approved", "paid"]).order("updated_at", { ascending: false }),
      supabase.from("cleaner_payouts").select("*").order("created_at", { ascending: false }),
      supabase.from("cleaner_payout_accounts").select("user_id,paypal_email"),
      supabase.rpc("list_cleaners"),
    ]);
    if (work.error || transfers.error || accounts.error || cleaners.error) throw new Error("Could not load PayPal payments.");
    return work.data.map(row => {
      const transfer = transfers.data.find(t => t.work_id === row.id) ?? null;
      return { ...row, transfer, group: paymentGroup(row, transfer), cleaner: cleaners.data.find(c => c.id === row.cleaner_id)?.full_name || "Housekeeper", receivingEmail: accounts.data.find(a => a.user_id === row.cleaner_id)?.paypal_email ?? null };
    });
  },
});