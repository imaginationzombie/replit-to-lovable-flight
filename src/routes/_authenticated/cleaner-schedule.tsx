import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ClipboardList, Settings } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BookingScheduler } from "@/components/BookingScheduler";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/cleaner-schedule")({
  head: () => ({
    meta: [
      { title: "My Schedule | HousekeepingBooking.com" },
      { name: "description", content: "Manage your assigned cleaning visits and personal schedule." },
      { property: "og:title", content: "My Schedule | HousekeepingBooking.com" },
      { property: "og:description", content: "Manage your assigned cleaning visits and personal schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CleanerSchedule,
});

function CleanerSchedule() {
  const { isCleaner, loading } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="flex items-center gap-3 text-3xl font-extrabold text-foreground"><CalendarDays className="h-7 w-7 text-primary" />My schedule</h1>
          {isCleaner && <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/cleaner"><ClipboardList />My jobs</Link></Button>
            <Button asChild variant="outline"><Link to="/availability"><Settings />Create availability</Link></Button>
          </div>}
        </div>
        {loading ? <p role="status" className="mt-6 text-muted-foreground">Loading schedule…</p> : isCleaner ? <BookingScheduler /> : <p role="alert" className="mt-6 text-muted-foreground">Cleaner access is required to view this schedule.</p>}
      </main>
    </div>
  );
}