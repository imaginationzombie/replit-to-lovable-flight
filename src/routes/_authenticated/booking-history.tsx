import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { History, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { fmtDate, STATUS_LABEL } from "@/components/BookingCard";
import { customerHistoryOptions, cleaningSettlement, tipSettlement } from "@/lib/customer-history";

export const Route = createFileRoute("/_authenticated/booking-history")({
  loader: ({ context }) => context.queryClient.ensureQueryData(customerHistoryOptions),
  head: () => ({ meta: [
    { title: "Booking & Payment History | HousekeepingBooking.com" },
    { name: "description", content: "Your cleaning visits, payment dates, customer tips and cleaner tip delivery status." },
    { property: "og:title", content: "Booking & Payment History | HousekeepingBooking.com" },
    { property: "og:description", content: "View your past cleaning bookings, payments and tip settlement dates." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  pendingComponent: () => <div><AppHeader /><p role="status" className="mx-auto max-w-5xl px-6 py-10">Loading your payment history…</p></div>,
  errorComponent: HistoryError,
  notFoundComponent: () => <p>Booking history not found.</p>,
  component: BookingHistory,
});

function HistoryError() {
  const router = useRouter();
  return <div><AppHeader /><main className="mx-auto max-w-5xl px-6 py-10"><p role="alert" className="mb-4 text-destructive">Couldn’t load your booking and payment history.</p><Button variant="outline" onClick={() => router.invalidate()}><RefreshCw />Try again</Button></main></div>;
}

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const timestamp = (value: string) => new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const paymentLabels = { settled: "Payment settled", due: "Payment due", cancelled: "Cancelled · no payment recorded", not_charged: "Not charged yet" };

function BookingHistory() {
  const history = useSuspenseQuery(customerHistoryOptions);
  const paidTotal = history.data.reduce((total, row) => total + (row.booking.paid_at ? row.booking.amount_cents : 0), 0);
  const tipTotal = history.data.reduce((total, row) => total + (row.tip?.status === "paid" && row.tip.environment === "live" ? row.tip.amount_cents : 0), 0);
  return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold text-foreground">Booking & payment history</h1><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Refresh payment history" title="Refresh payment history" disabled={history.isFetching} onClick={() => history.refetch()}><RefreshCw /></Button><Button asChild variant="outline"><Link to="/account">My account</Link></Button></div></div>
    <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-border py-6"><div><dt className="text-sm text-muted-foreground">Cleaning payments recorded</dt><dd className="mt-1 text-2xl font-bold text-primary">{money(paidTotal)}</dd></div><div><dt className="text-sm text-muted-foreground">Tips paid</dt><dd className="mt-1 text-2xl font-bold text-primary">{money(tipTotal)}</dd></div></dl>
    {history.isRefetchError && <p role="alert" className="mt-4 text-destructive">Couldn’t refresh. Showing your last loaded records.</p>}
    {!history.data.length && <section className="py-12 text-center"><History className="mx-auto text-primary" /><h2 className="mt-4 font-bold">No booking history yet</h2><Button asChild className="mt-4"><Link to="/book">Request a cleaning</Link></Button></section>}
    <div className="mt-6 space-y-4">{history.data.map(({ booking, tip }) => {
      const payment = cleaningSettlement(booking);
      const receipt = tip ? tipSettlement(tip) : null;
      return <article key={booking.id} className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-foreground">{booking.service}</h2><p className="mt-1 text-sm text-muted-foreground">{fmtDate(booking.preferred_date)} · {booking.time_window}</p><p className="mt-1 break-words text-sm text-muted-foreground">{booking.address}</p></div><span className="text-sm font-semibold text-primary">{STATUS_LABEL[booking.status] ?? booking.status}</span></div>
        <div className="mt-5 grid gap-5 border-t border-border pt-4 sm:grid-cols-2">
          <section><h3 className="text-sm font-bold">Cleaning payment · {money(booking.amount_cents)}</h3><p className="mt-2 text-sm text-foreground">{paymentLabels[payment.status as keyof typeof paymentLabels]}</p>{payment.date && <p className="mt-1 text-sm text-muted-foreground">Settled {timestamp(payment.date)}</p>}</section>
          <section><h3 className="text-sm font-bold">Tip{tip ? ` · ${money(tip.amount_cents)}` : ""}</h3>{!tip ? <p className="mt-2 text-sm text-muted-foreground">No tip recorded</p> : <div className="mt-2 space-y-1 text-sm"><p>{receipt?.test ? "Test payment · no live settlement" : receipt?.collectedAt ? `Tip payment settled ${timestamp(receipt.collectedAt)}` : "Tip checkout pending · not settled"}</p>{receipt?.collectedAt && !receipt.test && <p className="text-muted-foreground">{receipt.deliveredAt ? `Delivered to cleaner ${timestamp(receipt.deliveredAt)}` : tip.payout_status === "failed" || tip.payout_status === "needs_review" ? "Cleaner transfer needs review · not settled" : "Awaiting delivery to cleaner"}</p>}</div>}</section>
        </div>
        {booking.access_token && <div className="mt-5 flex justify-end"><Button asChild variant="outline" size="sm"><Link to="/booking/$id" params={{ id: booking.id }} search={{ t: booking.access_token }}>{payment.status === "due" ? "Pay balance" : "Booking details"}</Link></Button></div>}
      </article>;
    })}</div>
  </main></div>;
}