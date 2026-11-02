import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, RefreshCw, MapPin, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { fmtDate, type BookingRow } from "@/components/BookingCard";
import { customerBookingsOptions, visitSchedule } from "@/lib/customer-bookings";
import { dateKey } from "@/lib/scheduling";
import { CleanerLocation } from "@/components/CleanerLocation";

export const Route = createFileRoute("/_authenticated/booking-status")({
  loader: ({ context }) => context.queryClient.ensureQueryData(customerBookingsOptions),
  head: () => ({ meta: [
    { title: "My Booking Status | HousekeepingBooking.com" },
    { name: "description", content: "Check your cleaning booking status and scheduled appointment dates and times." },
    { property: "og:title", content: "My Booking Status | HousekeepingBooking.com" },
    { property: "og:description", content: "Check your cleaning booking status and scheduled appointment dates and times." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  pendingComponent: () => <div className="min-h-screen bg-background"><AppHeader /><p role="status" className="mx-auto max-w-5xl px-6 py-10 text-muted-foreground">Loading your booking status…</p></div>,
  errorComponent: ({ reset }) => <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-5xl px-6 py-10"><h1 className="text-3xl font-bold text-foreground">Booking status</h1><p role="alert" className="my-6 text-destructive">Couldn’t load your bookings.</p><Button onClick={reset} variant="outline"><RefreshCw />Try again</Button></main></div>,
  component: BookingStatus,
});

function Visit({ booking }: { booking: BookingRow }) {
  const label = booking.status === "pending_payment" ? "Awaiting checkout" : booking.status === "confirmed" ? "Confirmed" : booking.status === "completed" ? "Completed" : booking.status === "cancelled" ? "Cancelled" : "Awaiting confirmation";
  return <article className="rounded-lg border border-border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-lg font-bold text-foreground">{booking.service}</h3><p className="text-sm text-muted-foreground">{booking.frequency}{booking.visit_number && booking.visit_number > 1 ? ` · Visit ${booking.visit_number}` : ""}</p></div>
      <span className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">{label}</span>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm text-muted-foreground">{booking.status === "pending_payment" ? "Requested date" : "Visit date"}</p><p className="font-semibold text-foreground">{fmtDate(booking.preferred_date)}</p></div></div>
      <div className="flex items-start gap-3"><Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm text-muted-foreground">Arrival window</p><p className="font-semibold text-foreground">{booking.time_window}</p></div></div>
      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm text-muted-foreground">Cleaner appointment</p><p className="font-semibold text-foreground">{visitSchedule(booking)}</p></div></div>
      <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="text-sm text-muted-foreground">Address</p><p className="break-words font-semibold text-foreground">{booking.address}</p></div></div>
    </div>
    {booking.status === "confirmed" && booking.cleaner_id && <CleanerLocation bookingId={booking.id} />}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">{booking.paid_at ? "Paid" : booking.status === "completed" ? "Payment due" : booking.status === "confirmed" ? "Charged after cleaning" : ""}</p>
      {booking.access_token && <Button asChild variant="outline" size="sm"><Link to="/booking/$id" params={{ id: booking.id }} search={{ t: booking.access_token }}>Booking details</Link></Button>}
    </div>
  </article>;
}

function BookingStatus() {
  const bookings = useSuspenseQuery(customerBookingsOptions);
  const today = dateKey(new Date());
  const upcoming = bookings.data.filter(b => b.preferred_date >= today && b.status !== "completed" && b.status !== "cancelled");
  const other = bookings.data.filter(b => !upcoming.includes(b)).reverse();
  return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold text-foreground">Booking status</h1><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Refresh booking status" title="Refresh booking status" disabled={bookings.isFetching} onClick={() => bookings.refetch()}><RefreshCw className={bookings.isFetching ? "animate-spin" : ""} /></Button><Button asChild><Link to="/book">Book a cleaning</Link></Button></div></div>
    {bookings.isRefetchError && <p role="alert" className="mt-4 text-destructive">Couldn’t refresh. Showing your last loaded bookings.</p>}
    {!bookings.data.length ? <section className="mt-10 border-y border-border py-10 text-center"><CalendarDays className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-4 text-lg font-bold text-foreground">No bookings yet</h2><Button asChild variant="outline" className="mt-4"><Link to="/book">Book your first cleaning</Link></Button></section> : <>
      <section className="mt-8"><h2 className="mb-4 text-lg font-bold text-foreground">Upcoming visits</h2>{!upcoming.length && <p className="text-muted-foreground">No upcoming visits.</p>}<div className="space-y-4">{upcoming.map(b => <Visit key={b.id} booking={b} />)}</div></section>
      {other.length > 0 && <section className="mt-10"><h2 className="mb-4 text-lg font-bold text-foreground">Previous & cancelled visits</h2><div className="space-y-4">{other.map(b => <Visit key={b.id} booking={b} />)}</div></section>}
    </>}
  </main></div>;
}