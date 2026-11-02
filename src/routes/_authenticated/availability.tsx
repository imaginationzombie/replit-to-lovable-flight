import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, Save, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { DAY_NAMES, WEEK_DAYS, readWeeklyHours, validateWeeklyHours } from "@/lib/availability";
import { dateKey } from "@/lib/scheduling";

export const Route = createFileRoute("/_authenticated/availability")({
  head: () => ({ meta: [
    { title: "Schedule Creator | HousekeepingBooking.com" },
    { name: "description", content: "Set housekeeper appointment availability, weekly hours and days off." },
    { property: "og:title", content: "Schedule Creator | HousekeepingBooking.com" },
    { property: "og:description", content: "Set housekeeper appointment availability, weekly hours and days off." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const { user, isCleaner, loading } = useAuth();
  const qc = useQueryClient();
  const [hours, setHours] = useState(() => readWeeklyHours(null));
  const [off, setOff] = useState<string[]>([]);
  const [accepting, setAccepting] = useState(true);
  const [newOff, setNewOff] = useState("");
  const [dirty, setDirty] = useState(false);
  const settings = useQuery({
    queryKey: ["cleaner-portal-settings", user?.id],
    enabled: Boolean(user && isCleaner),
    queryFn: async () => {
      if (!user) throw new Error("Please sign in.");
      const { data, error } = await supabase.from("cleaner_settings").select("hourly_rate_cents, accepting_jobs, service_areas, weekly_hours, unavailable_dates").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!settings.isSuccess || dirty) return;
    setHours(readWeeklyHours(settings.data?.weekly_hours));
    setOff(settings.data?.unavailable_dates ?? []);
    setAccepting(settings.data?.accepting_jobs ?? true);
  }, [settings.data, settings.isSuccess, dirty]);
  const save = useMutation({
    mutationFn: async () => {
      if (!user || !isCleaner) throw new Error("Cleaner access is required.");
      validateWeeklyHours(hours);
      const { error } = await supabase.from("cleaner_settings").upsert({
        user_id: user.id, weekly_hours: hours as unknown as Json,
        unavailable_dates: off, accepting_jobs: accepting, updated_at: new Date().toISOString(),
      }).select("user_id").single();
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all(["cleaner-portal-settings", "cleaner-portal", "admin-cleaner-settings", "scheduler-bookings"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      setDirty(false);
    },
  });
  function edit() { setDirty(true); save.reset(); }
  const input = "min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
  return <div className="min-h-screen bg-background">
    <AppHeader />
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-extrabold text-foreground"><CalendarClock className="h-7 w-7 shrink-0 text-primary" />Schedule creator</h1>
        <Button asChild variant="outline"><Link to="/cleaner-schedule">My appointments</Link></Button>
      </div>
      {loading || (isCleaner && settings.isLoading) ? <p role="status" className="mt-6 text-muted-foreground">Loading availability…</p> : !isCleaner ? <p className="mt-6 text-muted-foreground">Cleaner access is required to set appointment availability.</p> : settings.error ? <div className="mt-6"><p role="alert" className="text-destructive">Couldn’t load availability.</p><Button variant="outline" onClick={() => settings.refetch()}>Try again</Button></div> : <form onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <fieldset disabled={save.isPending} className="min-w-0">
          <section className="mt-8 flex items-center justify-between gap-4 border-b border-border pb-6">
            <h2 className="font-bold text-foreground">Accepting appointments</h2>
            <Switch aria-label="Accepting appointments" checked={accepting} onCheckedChange={value => { edit(); setAccepting(value); }} />
          </section>
          <section className="mt-6">
            <h2 className="mb-4 text-lg font-bold text-foreground">Weekly appointment hours</h2>
            <div className="divide-y divide-border border-y border-border">
              {WEEK_DAYS.map(day => <div key={day} className="grid gap-3 py-4 sm:grid-cols-[180px_1fr] sm:items-center">
                <label className="flex items-center gap-3 font-semibold text-foreground"><Switch aria-label={`${DAY_NAMES[day]} available`} checked={hours[day].on} onCheckedChange={on => { edit(); setHours({ ...hours, [day]: { ...hours[day], on } }); }} />{DAY_NAMES[day]}</label>
                {hours[day].on ? <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <input required type="time" aria-label={`${DAY_NAMES[day]} start`} className={input} value={hours[day].start} onChange={e => { edit(); setHours({ ...hours, [day]: { ...hours[day], start: e.target.value } }); }} />
                  <span className="text-sm text-muted-foreground">to</span>
                  <input required type="time" aria-label={`${DAY_NAMES[day]} end`} className={input} value={hours[day].end} onChange={e => { edit(); setHours({ ...hours, [day]: { ...hours[day], end: e.target.value } }); }} />
                </div> : <span className="text-sm text-muted-foreground">Unavailable</span>}
              </div>)}
            </div>
          </section>
          <section className="mt-8 border-b border-border pb-6">
            <h2 className="text-lg font-bold text-foreground">Days off</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <input type="date" min={dateKey(new Date())} aria-label="Day off" className={input} value={newOff} onChange={e => setNewOff(e.target.value)} />
              <Button type="button" variant="outline" disabled={!newOff || newOff < dateKey(new Date())} onClick={() => { edit(); setOff([...new Set([...off, newOff])].sort()); setNewOff(""); }}><Plus />Add day off</Button>
            </div>
            <ul className="mt-4 space-y-2">{off.map(date => <li key={date} className="flex items-center justify-between gap-3 text-sm text-foreground"><span>{new Date(`${date}T12:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${date}`} title="Remove day off" onClick={() => { edit(); setOff(off.filter(d => d !== date)); }}><X /></Button></li>)}</ul>
            {!off.length && <p className="mt-3 text-sm text-muted-foreground">No days off added.</p>}
          </section>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!dirty || save.isPending}><Save />{save.isPending ? "Saving…" : "Save availability"}</Button>
            {dirty && !save.error && <p className="text-sm text-muted-foreground">Unsaved changes</p>}
            {save.isSuccess && !dirty && <p role="status" className="text-sm text-primary">Availability saved.</p>}
            {save.error && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
          </div>
        </fieldset>
      </form>}
    </main>
  </div>;
}