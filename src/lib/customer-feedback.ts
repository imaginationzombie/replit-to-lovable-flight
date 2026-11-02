import { z } from "zod";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const disputeSchema = z.object({ bookingId: z.string().uuid(), kind: z.enum(["unpaid", "uncleaned"]), details: z.string().trim().min(10).max(2000) });
export const resolutionSchema = z.object({ status: z.enum(["open", "reviewing", "resolved", "dismissed"]), resolution: z.string().trim().max(2000) }).refine(v => !["resolved", "dismissed"].includes(v.status) || v.resolution.length >= 3, { message: "Add a resolution note for a final decision." });
export const reviewSchema = z.object({ bookingId: z.string().uuid(), rating: z.number().int().min(1).max(5), body: z.string().trim().min(10).max(2000), publicName: z.string().trim().min(1).max(60) });
export function canReviewBooking(b: { status: string; cleaner_id: string | null }) { return b.status === "completed" && Boolean(b.cleaner_id); }
export const DISPUTE_STATUS = { open: "Open", reviewing: "Under review", resolved: "Resolved", dismissed: "Dismissed" } as const;
export const disputesOptions = (admin = false) => queryOptions({
  queryKey: ["booking-disputes", admin], refetchInterval: 15000,
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Sign in to view disputes.");
    const query = supabase.from("booking_disputes").select("*, bookings(service, preferred_date, time_window, customer_name)").order("created_at", { ascending: false });
    const { data, error } = await (admin ? query : query.eq("customer_id", auth.user.id));
    if (error) throw error;
    return data;
  },
});
export const ownReviewsOptions = queryOptions({ queryKey: ["my-cleaning-reviews"], queryFn: async () => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to review a cleaning.");
  const { data, error } = await supabase.from("cleaner_reviews").select("booking_id, rating, body, public_name").eq("customer_id", auth.user.id);
  if (error) throw error;
  return data;
} });