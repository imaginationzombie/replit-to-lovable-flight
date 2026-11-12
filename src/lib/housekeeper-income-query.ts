import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { housekeeperIncome } from "./housekeeper-income";
export const housekeeperIncomeOptions = queryOptions({ queryKey: ["housekeeper-income"], refetchInterval: 15000, queryFn: async () => {
 const { data: auth } = await supabase.auth.getUser(); if (!auth.user) throw new Error("Sign in required.");
 const { data: admin, error } = await supabase.rpc("has_role", { _user_id: auth.user.id, _role: "admin" }); if (error || !admin) throw new Error("Admin access required.");
 const [cleaners, work, tips, completed, payouts] = await Promise.all([supabase.rpc("list_cleaners"), supabase.from("appointment_work").select("id,cleaner_id,amount_cents,status,paid_at"), supabase.from("booking_tips").select("cleaner_id,amount_cents,status,environment,customer_confirmed_at,payout_status,payout_paid_at,paypal_item_id"), supabase.from("bookings").select("cleaner_id").eq("status", "completed"), supabase.from("cleaner_payouts").select("work_id,environment,status,provider_status,paypal_item_id")]);
 if (cleaners.error || work.error || tips.error || completed.error || payouts.error) throw new Error("Could not load housekeeper income.");
 return housekeeperIncome(cleaners.data, work.data, tips.data, completed.data, payouts.data);
} });