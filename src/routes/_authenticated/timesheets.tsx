import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { TimesheetList } from "@/components/TimesheetList";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { PayoutAccount } from "@/components/PayoutAccount";

export const Route = createFileRoute("/_authenticated/timesheets")({
  head: () => ({ meta: [
    { title: "My Timesheets & Payments | HousekeepingBooking.com" }, { name: "description", content: "Track your cleaning hours, submitted timesheets and recorded payments." },
    { property: "og:title", content: "My Timesheets & Payments | HousekeepingBooking.com" }, { property: "og:description", content: "Track your cleaning hours, submitted timesheets and recorded payments." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Timesheets,
});
function Timesheets() {
  const { user, isCleaner, loading } = useAuth();
  return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-5xl px-6 py-10">
    <div className="flex flex-wrap justify-between gap-3"><h1 className="text-3xl font-extrabold">My timesheets & payments</h1><Button asChild variant="outline"><Link to="/cleaner">My appointments</Link></Button></div>
    {loading ? <p role="status" className="mt-6">Loading…</p> : isCleaner && user ? <><PayoutAccount userId={user.id} /><TimesheetList userId={user.id} /></> : <p role="alert" className="mt-6">Cleaner access required.</p>}
  </main></div>;
}