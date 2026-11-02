import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { refreshBookingViews } from "@/lib/booking-sync";
import { fmtDate } from "@/components/BookingCard";
import { CalendarPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/waiting-list")({
  head: () => ({ meta: [
    { title: "Available Cleanings | HousekeepingBooking.com" }, { name: "description", content: "Choose waiting cleaning appointments for your schedule." },
    { property: "og:title", content: "Available Cleanings | HousekeepingBooking.com" }, { property: "og:description", content: "Choose waiting cleaning appointments for your schedule." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: WaitingList,
});
function WaitingList() {
  const { user, isCleaner, loading } = useAuth(); const qc = useQueryClient();
  const list = useQuery({ queryKey: ["waiting-list", user?.id], enabled: isCleaner, refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.rpc("waiting_cleanings"); if (error) throw error; return data;
  } });
  const claim = useMutation({ mutationFn: async (id: string) => {
    const { error } = await supabase.rpc("claim_cleaning", { _booking_id: id }); if (error) throw error;
  }, onSuccess: () => refreshBookingViews(qc) });
  return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-5xl px-6 py-10">
    <div className="flex flex-wrap justify-between gap-3"><h1 className="text-3xl font-extrabold">Waiting list</h1><div className="flex gap-2"><Button variant="outline" asChild><Link to="/availability">My availability</Link></Button><Button variant="outline" asChild><Link to="/cleaner-schedule">My schedule</Link></Button></div></div>
    {!loading && !isCleaner && <p role="alert" className="mt-6">Cleaner access is required.</p>}
    {list.isLoading && <p role="status" className="mt-6">Loading available cleanings…</p>}
    {(claim.error || list.error) && <p role="alert" className="mt-5 text-destructive">{(claim.error ?? list.error)?.message}</p>}
    {claim.isSuccess && <p role="status" className="mt-5 text-primary">Added to your schedule.</p>}
    {list.isSuccess && list.data.length === 0 && <p className="mt-8 text-muted-foreground">No cleanings waiting for a housekeeper.</p>}
    <div className="mt-6 grid gap-4 md:grid-cols-2">{list.data?.map(visit => <article key={visit.id} className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-bold">{visit.service}</h2><p className="mt-1 text-sm text-muted-foreground">{visit.service_area} · {visit.bedrooms} bed / {visit.bathrooms} bath</p>
      <p className="mt-4 font-semibold">{fmtDate(visit.preferred_date)}</p><p className="text-sm text-muted-foreground">{visit.time_window}</p>
      {visit.add_ons.length > 0 && <p className="mt-2 text-sm">Add-ons: {visit.add_ons.join(", ")}</p>}
      <Button className="mt-4" disabled={claim.isPending} onClick={() => claim.mutate(visit.id)}><CalendarPlus />Add to my schedule</Button>
    </article>)}</div>
  </main></div>;
}