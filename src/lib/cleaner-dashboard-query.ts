import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { housekeeperIncome } from "./housekeeper-income";

export function cleanerIncomeOptions(userId: string) {
  return queryOptions({
    queryKey: ["cleaner-dashboard-income", userId],
    refetchInterval: 15000,
    queryFn: async () => {
      const [work, tips, completed, payouts] = await Promise.all([
        supabase.from("appointment_work").select("id,cleaner_id,amount_cents,status,paid_at").eq("cleaner_id", userId),
        supabase.from("booking_tips").select("cleaner_id,amount_cents,status,environment,customer_confirmed_at,payout_status,payout_paid_at,paypal_item_id").eq("cleaner_id", userId),
        supabase.from("bookings").select("cleaner_id").eq("cleaner_id", userId).eq("status", "completed"),
        supabase.from("cleaner_payouts").select("work_id,environment,status,provider_status,paypal_item_id").eq("cleaner_id", userId),
      ]);
      const error = work.error ?? tips.error ?? completed.error ?? payouts.error;
      if (error) throw error;
      const income = housekeeperIncome([{ id: userId, full_name: "" }], work.data ?? [], tips.data ?? [], completed.data ?? [], payouts.data ?? [])[0];
      if (!income) throw new Error("Could not load your earnings.");
      return income;
    },
  });
}