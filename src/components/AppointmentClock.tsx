import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, MapPin } from "lucide-react";
import { elapsed, getPosition, LOCATION_INTERVAL_MS } from "@/lib/time-clock";
export function AppointmentClock({ bookingId, userId, active }: { bookingId: string; userId: string; active: boolean }) {
 const qc = useQueryClient(); const [now, setNow] = useState(() => new Date());
 const open = useQuery({ queryKey: ["time-clock", "appointment", userId], refetchInterval: 15000, queryFn: async () => {
  const { data, error } = await supabase.from("time_clock_entries").select("id,booking_id,clock_in_at").eq("user_id", userId).is("clock_out_at", null).maybeSingle(); if (error) throw error; return data;
 } });
 const here = open.data?.booking_id === bookingId;
 useEffect(() => {
  if (!here) return;
  const tick = setInterval(() => setNow(new Date()), 30000);
  const ping = setInterval(async () => { try { const c = await getPosition(); await supabase.rpc("record_location", { _lat: c.lat, _lng: c.lng, _accuracy: c.accuracy ?? 0 }); } catch { /* Next interval retries location only. */ } }, LOCATION_INTERVAL_MS);
  return () => { clearInterval(tick); clearInterval(ping); };
 }, [here]);
 const clock = useMutation({ mutationFn: async (out: boolean) => {
  const c = await getPosition(); const { error } = out ? await supabase.rpc("clock_out", { _lat: c.lat, _lng: c.lng, _accuracy: c.accuracy ?? 0 }) : await supabase.rpc("clock_in", { _booking: bookingId, _lat: c.lat, _lng: c.lng, _accuracy: c.accuracy ?? 0 }); if (error) throw error;
 }, onSuccess: () => qc.invalidateQueries({ queryKey: ["time-clock"] }) });
 return <section className="border-t border-border py-6"><h2 className="text-xl font-bold">Appointment clock</h2><p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />Location recorded during this appointment</p>
 {here && open.data ? <><p className="mt-3 text-3xl font-bold">{elapsed(open.data.clock_in_at, now)}</p><Button className="mt-3" disabled={clock.isPending} onClick={() => clock.mutate(true)}><LogOut />Clock out</Button></> : <Button className="mt-4" disabled={!active || open.isPending || open.isError || !!open.data || clock.isPending} onClick={() => clock.mutate(false)}><LogIn />Clock into this appointment</Button>}
 {open.data && !here && <p className="mt-3 text-sm">You are clocked into another appointment. Clock out there first.</p>}
 {(clock.error || open.error) && <p role="alert" className="mt-3 text-destructive">{(clock.error || open.error)?.message}</p>}
 </section>;
}
