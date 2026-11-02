import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import type { Json } from "@/integrations/supabase/types";
import { validateWeeklyHours } from "@/lib/availability";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cleaner-profile")({
  head: () => ({
    meta: [
      { title: "Cleaner Portal | HousekeepingBooking.com" },
      { name: "description", content: "Set your schedule, rates, availability and profile." },
      { property: "og:title", content: "Cleaner Portal | HousekeepingBooking.com" },
      { property: "og:description", content: "Set your schedule, rates, availability and profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CleanerPortal,
});

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
type Hours = Record<(typeof DAYS)[number], { on: boolean; start: string; end: string }>;
const defaultHours = (): Hours => Object.fromEntries(DAYS.map((d) => [d, { on: d !== "sun", start: "08:00", end: "17:00" }])) as Hours;

function CleanerPortal() {
  const { user, isCleaner, loading } = useAuth();
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["cleaner-portal", user?.id],
    enabled: !!user && isCleaner,
    queryFn: async () => {
      const [p, s] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, address").eq("id", user!.id).single(),
        supabase.from("cleaner_settings").select("*").eq("user_id", user!.id).maybeSingle(),
      ]);
      if (p.error) throw p.error;
      if (s.error) throw s.error;
      return { profile: p.data, settings: s.data };
    },
  });

  const [f, setF] = useState({ full_name: "", phone: "", address: "", bio: "", rate: "", service_areas: "", accepting_jobs: true });
  const [hours, setHours] = useState<Hours>(defaultHours);
  const [off, setOff] = useState<string[]>([]);
  const [newOff, setNewOff] = useState("");
  useEffect(() => {
    if (!data.data) return;
    const { profile, settings } = data.data;
    setF({
      full_name: profile.full_name, phone: profile.phone, address: profile.address,
      bio: settings?.bio ?? "", rate: settings ? String(settings.hourly_rate_cents / 100) : "",
      service_areas: settings?.service_areas ?? "", accepting_jobs: settings?.accepting_jobs ?? true,
    });
    const wh = settings?.weekly_hours as unknown as Partial<Hours> | undefined;
    setHours({ ...defaultHours(), ...(wh ?? {}) });
    setOff(settings?.unavailable_dates ?? []);
  }, [data.data]);

  const save = useMutation({
    mutationFn: async () => {
      validateWeeklyHours(hours);
      const rate = Math.round(Number(f.rate || 0) * 100);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100000) throw new Error("Enter an hourly rate between $0 and $1,000.");
      const p = await supabase.from("profiles").update({ full_name: f.full_name.trim().slice(0, 120), phone: f.phone.trim().slice(0, 40), address: f.address.trim().slice(0, 300) }).eq("id", user!.id);
      if (p.error) throw p.error;
      const s = await supabase.from("cleaner_settings").upsert({
        user_id: user!.id, bio: f.bio.slice(0, 1000), hourly_rate_cents: rate, service_areas: f.service_areas.slice(0, 300),
        accepting_jobs: f.accepting_jobs, weekly_hours: hours as unknown as Json, unavailable_dates: off, updated_at: new Date().toISOString(),
      });
      if (s.error) throw s.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cleaner-portal"] });
      qc.invalidateQueries({ queryKey: ["cleaner-portal-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-cleaner-settings"] });
      qc.invalidateQueries({ queryKey: ["cleaners"] });
    },
  });

  const input = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";
  const label = "block text-sm font-semibold text-foreground";
  const card = "mt-6 rounded-2xl border border-border bg-card p-6";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold text-foreground">Cleaner portal</h1>
          <div className="flex flex-wrap items-center gap-3"><Button asChild variant="outline"><Link to="/availability">Schedule creator</Link></Button><Link to="/cleaner-schedule" className="text-sm font-bold text-primary">View my schedule →</Link></div>
        </div>
        {!loading && !isCleaner && <p className="mt-6 rounded-xl bg-muted p-6 text-muted-foreground">This page is for cleaners. Ask an admin to give your account cleaner access.</p>}
        {isCleaner && data.isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {isCleaner && data.data && (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <section className={card}>
              <h2 className="text-lg font-bold text-foreground">Profile</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className={label}>Full name<input className={input} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></label>
                <label className={label}>Phone<input className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
                <label className={`${label} sm:col-span-2`}>Address<input className={input} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
                <label className={`${label} sm:col-span-2`}>About me<textarea rows={3} className={input} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Experience, specialties, languages…" /></label>
              </div>
            </section>

            <section className={card}>
              <h2 className="text-lg font-bold text-foreground">Rates & areas</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className={label}>Hourly rate (USD)<input type="number" min={0} max={1000} step="0.5" className={input} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></label>
                <label className={label}>Service areas<input className={input} value={f.service_areas} onChange={(e) => setF({ ...f, service_areas: e.target.value })} placeholder="e.g. Spokane, Spokane Valley" /></label>
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground sm:col-span-2">
                  <input type="checkbox" checked={f.accepting_jobs} onChange={(e) => setF({ ...f, accepting_jobs: e.target.checked })} /> Accepting new jobs
                </label>
              </div>
            </section>

            <section className={card}>
              <h2 className="text-lg font-bold text-foreground">Weekly schedule</h2>
              <div className="mt-4 space-y-2">
                {DAYS.map((d) => (
                  <div key={d} className="flex flex-wrap items-center gap-3">
                    <label className="flex w-36 items-center gap-2 text-sm font-semibold text-foreground">
                      <input type="checkbox" checked={hours[d].on} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], on: e.target.checked } })} /> {DAY_LABEL[d]}
                    </label>
                    {hours[d].on ? (
                      <>
                        <input type="time" aria-label={`${DAY_LABEL[d]} start`} className="rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground" value={hours[d].start} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], start: e.target.value } })} />
                        <span className="text-muted-foreground">to</span>
                        <input type="time" aria-label={`${DAY_LABEL[d]} end`} className="rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground" value={hours[d].end} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], end: e.target.value } })} />
                      </>
                    ) : <span className="text-sm text-muted-foreground">Off</span>}
                  </div>
                ))}
              </div>
            </section>

            <section className={card}>
              <h2 className="text-lg font-bold text-foreground">Days off</h2>
              <div className="mt-3 flex gap-2">
                <input type="date" min={today} aria-label="Add a day off" className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground" value={newOff} onChange={(e) => setNewOff(e.target.value)} />
                <button type="button" disabled={!newOff} onClick={() => { if (!off.includes(newOff)) setOff([...off, newOff].sort()); setNewOff(""); }} className="rounded-lg bg-muted px-3 py-1.5 text-sm font-bold text-foreground">Add</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {off.length === 0 && <span className="text-sm text-muted-foreground">No days off added.</span>}
                {off.map((d) => (
                  <span key={d} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                    {new Date(d + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    <button type="button" aria-label={`Remove ${d}`} onClick={() => setOff(off.filter((x) => x !== d))}>×</button>
                  </span>
                ))}
              </div>
            </section>

            <div className="mt-6 flex items-center gap-3">
              <button type="submit" disabled={save.isPending} className="rounded-lg bg-primary px-5 py-2.5 font-bold text-primary-foreground">{save.isPending ? "Saving…" : "Save changes"}</button>
              {save.isSuccess && <span className="text-sm text-primary">Saved.</span>}
              {save.error && <span className="text-sm text-destructive">{save.error.message}</span>}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
