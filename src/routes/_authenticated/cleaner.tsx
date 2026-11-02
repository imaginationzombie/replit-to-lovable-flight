import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { BookingCard, type BookingRow } from "@/components/BookingCard";
import { useAuth } from "@/hooks/use-auth";

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
  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cleaner_complete_booking", { _booking_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cleaner-jobs"] }),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold text-foreground">My jobs</h1>{isCleaner && <Link to="/cleaner-profile" className="text-sm font-bold text-primary">Schedule, rates & profile →</Link>}</div>
        {!loading && !isCleaner && <p className="mt-6 rounded-xl bg-muted p-6 text-muted-foreground">This page is for cleaners. Ask an admin to give your account cleaner access.</p>}
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
