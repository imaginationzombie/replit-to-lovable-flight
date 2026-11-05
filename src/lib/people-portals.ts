import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
export const messageSchema = z.string().trim().min(1).max(3000);
export const applicationSchema = z.object({ full_name: z.string().trim().min(1).max(100), phone: z.string().max(30), service_areas: z.string().trim().min(1).max(500), experience: z.string().trim().min(1).max(3000), availability: z.string().trim().min(1).max(1000) });
export const applicationsOptions = queryOptions({ queryKey: ["hiring-applications"], queryFn: async () => { const { data, error } = await supabase.from("hiring_applications").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; }, refetchInterval: 15000 });
export const myApplicationOptions = (userId: string) => queryOptions({ queryKey: ["hiring-applications", "owner", userId], queryFn: async () => { const { data, error } = await supabase.from("hiring_applications").select("*").eq("user_id", userId).order("created_at", { ascending: false }); if (error) throw error; return data; }, refetchInterval: 15000 });
export const threadsOptions = queryOptions({ queryKey: ["message-threads"], queryFn: async () => { const { data, error } = await supabase.from("message_threads").select("*,bookings(service,preferred_date,customer_name)").order("created_at", { ascending: false }); if (error) throw error; return data; }, refetchInterval: 5000 });
export async function photoUrl(path: string) {
  if (!path) return "";
  const { data, error } = await supabase.storage.from("housekeeper-portfolios").createSignedUrl(path, 3600);
  if (error) throw new Error("Could not load this photo.");
  return data.signedUrl;
}
export const portfolioOptions = (id: string) => queryOptions({ queryKey: ["housekeeper-portfolio", id], queryFn: async () => {
  const { data, error } = await supabase.from("housekeeper_portfolios").select("*").eq("user_id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: gallery, error: ge } = await supabase.from("housekeeper_gallery").select("*").eq("user_id", id).order("created_at", { ascending: false });
  if (ge) throw ge;
  return { ...data, portrait: await photoUrl(data.portrait_path), gallery: await Promise.all(gallery.map(async g => ({ ...g, before: await photoUrl(g.before_path), after: await photoUrl(g.after_path) }))) };
} });