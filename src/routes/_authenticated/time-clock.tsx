import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MapPin, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { directionsLink, elapsed, getPosition, LOCATION_INTERVAL_MS, mapLink } from "@/lib/time-clock";

export const Route = createFileRoute("/_authenticated/time-clock")({
  head: () => ({
    meta: [
      { title: "Time clock | HousekeepingBooking.com" },
      { name: "description", content: "Clock in and out of cleaning appointments with location tracking." },
      { property: "og:title", content: "Time clock | HousekeepingBooking.com" },
      { property: "og:description", content: "Clock in and out of cleaning appointments with location tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimeClockPage,
});

const today = () => new Date().toLocaleDateString("en-CA");

function TimeClockPage() {
  const { user, isAdmin, isCleaner, loading } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [now, setNow] = useState(() => new Date());

  const open = useQuery({
    queryKey: ["time-clock", "open", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("time_clock_entries").select("*, bookings(service, address, time_window)").eq("user_id", user!.id).is("clock_out_at", null).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const visits = useQuery({
    queryKey: ["time-clock", "visits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("id, service, address, time_window, preferred_date").eq("cleaner_id", user!.id).eq("status", "confirmed").eq("preferred_date", today()).order("time_window");
      if (error) throw error;
      return data;
    },
  });
  const history = useQuery({
    queryKey: ["time-clock", "history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("time_clock_entries").select("id, clock_in_at, clock_out_at, in_lat, in_lng, out_lat, out_lng, bookings(service)").eq("user_id", user!.id).not("clock_out_at", "is", null).order("clock_in_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });
  const team = useQuery({
    queryKey: ["time-clock", "team"],
    enabled: isAdmin,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("time_clock_entries").select("id, user_id, clock_in_at, last_lat, last_lng, last_seen_at, profiles(full_name, email), bookings(service, address)").is("clock_out_at", null).order("clock_in_at");
      if (error) throw error;
      return data;
    },
  });

  const entry = open.data;

  // Live tracking while clocked in and the page is open.
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30000);
    if (!entry) return () => clearInterval(tick);
    const send = async () => {
      try {
        const c = await getPosition();
        await supabase.rpc("record_location", { _lat: c.lat, _lng: c.lng, _accuracy: c.accuracy ?? 0 });
      } catch { /* keep trying on next interval */ }
    };
    const id = setInterval(send, LOCATION_INTERVAL_MS);
    return () => { clearInterval(id); clearInterval(tick); };
  }, [entry?.id]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["time-clock"] });

  async function clockIn() {
    if (!bookingId && !isAdmin) { toast.error("Choose the appointment you're clocking in for."); return; }
    setBusy(true);
    try {
      const c = await getPosition();
      const { error } = await supabase.rpc("clock_in", { _booking: (bookingId || null) as string, _lat: c.lat, _lng: c.lng, _accuracy: c.accuracy ?? 0 });
      if (error) throw error;
      toast.success("Clocked in");
      refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function clockOut() {
    setBusy(true);
    try {
      const c = await getPosition();
      const { error } = await supabase.rpc("clock_out", { _lat: c.lat, _lng: c.lng, _accuracy: c.accuracy ?? 0 });
      if (error) throw error;
      toast.success("Clocked out");
      refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (!loading && !isAdmin && !isCleaner) {
    return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-3xl px-6 py-10"><h1 className="text-3xl font-extrabold text-foreground">Time clock</h1><p className="mt-4 text-muted-foreground">The time clock is for housekeepers and staff.</p></main></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <h1 className="text-3xl font-extrabold text-foreground">Time clock</h1>

        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          {entry ? (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Clocked in</p>
              <p className="my-2 text-5xl font-extrabold text-foreground">{elapsed(entry.clock_in_at, now)}</p>
              <p className="text-muted-foreground">{entry.bookings ? `${entry.bookings.service} · ${entry.bookings.address}` : "General shift"}</p>
              {entry.bookings?.address && <Button asChild variant="outline" className="mt-3"><a href={directionsLink(entry.bookings.address)} target="_blank" rel="noreferrer"><MapPin />Directions to client</a></Button>}
              <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />Sharing location every 2 minutes while this page is open</p>
              <Button size="lg" variant="destructive" className="mt-6 h-16 w-full max-w-xs text-lg" disabled={busy} onClick={clockOut}><LogOut />Clock out</Button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Clocked out</p>
              <label className="mx-auto mt-4 block max-w-sm text-left text-sm font-semibold text-foreground">Appointment
                <select aria-label="Appointment" value={bookingId} onChange={(e) => setBookingId(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2">
                  <option value="">{isAdmin ? "General shift (no appointment)" : "Choose today's appointment"}</option>
                  {visits.data?.map((v) => <option key={v.id} value={v.id}>{v.time_window} · {v.service} · {v.address}</option>)}
                </select>
              </label>
              {visits.data?.map((v) => <a key={v.id} className="mt-2 block text-sm font-semibold text-primary underline" href={directionsLink(v.address)} target="_blank" rel="noreferrer">Directions: {v.address}</a>)}
              {visits.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No appointments assigned to you today.</p>}
              <Button size="lg" className="mt-6 h-16 w-full max-w-xs text-lg" disabled={busy} onClick={clockIn}><LogIn />Clock in</Button>
              <p className="mt-2 text-xs text-muted-foreground">Your location is recorded when you clock in, while clocked in, and when you clock out.</p>
            </>
          )}
        </section>

        {isAdmin && (
          <section>
            <h2 className="mb-3 text-xl font-bold text-foreground">Who's clocked in</h2>
            {team.data?.length ? (
              <ul className="space-y-2">
                {team.data.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4">
                    <div>
                      <p className="font-semibold text-foreground">{t.profiles?.full_name || t.profiles?.email}</p>
                      <p className="text-sm text-muted-foreground">{t.bookings ? `${t.bookings.service} · ${t.bookings.address}` : "General shift"} · {elapsed(t.clock_in_at, now)}</p>
                      {t.last_seen_at && <p className="text-xs text-muted-foreground">Last location {new Date(t.last_seen_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
                    </div>
                    {t.last_lat != null && t.last_lng != null && <Button asChild variant="outline" size="sm"><a href={mapLink(t.last_lat, t.last_lng)} target="_blank" rel="noreferrer"><MapPin />View on map</a></Button>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">Nobody is clocked in right now.</p>}
          </section>
        )}

        <section>
          <h2 className="mb-3 text-xl font-bold text-foreground">Recent shifts</h2>
          {history.data?.length ? (
            <ul className="space-y-2">
              {history.data.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 text-sm">
                  <span className="text-foreground"><strong>{h.bookings?.service ?? "General shift"}</strong> · {new Date(h.clock_in_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} – {new Date(h.clock_out_at!).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ({elapsed(h.clock_in_at, new Date(h.clock_out_at!))})</span>
                  <span className="flex gap-3">
                    {h.in_lat != null && h.in_lng != null && <a className="text-primary underline" href={mapLink(h.in_lat, h.in_lng)} target="_blank" rel="noreferrer">In location</a>}
                    {h.out_lat != null && h.out_lng != null && <a className="text-primary underline" href={mapLink(h.out_lat, h.out_lng)} target="_blank" rel="noreferrer">Out location</a>}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground">No completed shifts yet.</p>}
        </section>
      </main>
    </div>
  );
}
