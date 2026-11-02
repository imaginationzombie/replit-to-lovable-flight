import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { BookingCard, type BookingRow } from "@/components/BookingCard";
import { useAuth } from "@/hooks/use-auth";
import { hoursSummary } from "@/lib/cleaner-hours";
import { useServerFn } from "@tanstack/react-start";
import { completeBooking } from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated/cleaner")({
  head: () => ({
    meta: [
      { title: "My Jobs | HousekeeperBooking.com" },
      { name: "description", content: "Cleaning jobs assigned to you." },
      { property: "og:title", content: "My Jobs | HousekeeperBooking.com" },
      { property: "og:description", content: "Cleaning jobs assigned to you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CleanerJobs,
});

function CleanerJobs() {
  const { user, isCleaner, loading } = useAuth();
  const qc = useQueryClient();
  const jobs = useQuery({
    queryKey: ["cleaner-jobs", user?.id],
    enabled: !!user && isCleaner,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").eq("cleaner_id", user!.id).order("preferred_date");
      if (error) throw error;
      return data as BookingRow[];
    },
  });
  const settings = useQuery({
    queryKey: ["cleaner-portal-settings", user?.id],
    enabled: !!user && isCleaner,
    queryFn: async () => {
      const { data, error } = await supabase.from("cleaner_settings").select("hourly_rate_cents, accepting_jobs, service_areas, weekly_hours, unavailable_dates").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const completeFn = useServerFn(completeBooking);
  const complete = useMutation({
    mutationFn: async (id: string) => {
      const r = await completeFn({ data: { bookingId: id } });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cleaner-jobs"] }),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold text-foreground">My jobs</h1>{isCleaner && <Link to="/cleaner-profile" className="text-sm font-bold text-primary">Schedule, rates & profile →</Link>}</div>
        {!loading && !isCleaner && <p className="mt-6 rounded-xl bg-muted p-6 text-muted-foreground">This page is for cleaners. Ask an admin to give your account cleaner access.</p>}
        {isCleaner && settings.isSuccess && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm">
            {settings.data ? (<>
              <p className="font-bold text-foreground">${(settings.data.hourly_rate_cents / 100).toFixed(2)}/hr · {settings.data.accepting_jobs ? "Accepting new jobs" : "Not accepting new jobs"}{settings.data.service_areas ? ` · ${settings.data.service_areas}` : ""}</p>
              <p className="mt-1 text-muted-foreground">Hours: {hoursSummary(settings.data.weekly_hours)}</p>
              {settings.data.unavailable_dates.length > 0 && <p className="mt-1 text-muted-foreground">Days off: {settings.data.unavailable_dates.join(", ")}</p>}
            </>) : <p className="text-muted-foreground">You haven't set your rate or hours yet.</p>}
          </div>
        )}
        {jobs.isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {jobs.data?.length === 0 && <p className="mt-6 rounded-xl bg-muted p-6 text-muted-foreground">No jobs assigned yet.</p>}
        <div className="mt-6 space-y-3">
          {jobs.data?.map((b) => (
            <BookingCard key={b.id} b={b} showCustomer>
              {b.status === "confirmed" && (
                <button onClick={() => complete.mutate(b.id)} disabled={complete.isPending} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">Mark completed</button>
              )}
            </BookingCard>
          ))}
        </div>
      </main>
    </div>
  );
}
