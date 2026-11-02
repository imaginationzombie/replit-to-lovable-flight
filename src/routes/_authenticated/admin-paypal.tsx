import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, RefreshCw, ArrowLeft, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { PayoutTransfer } from "@/components/PayoutTransfer";
import { payoutConfig } from "@/lib/payouts.functions";
import { payoutDashboardOptions, type PaymentGroup } from "@/lib/payout-dashboard";

const labels: Record<PaymentGroup, string> = { approved: "Approved earnings", pending: "Pending transfers", settled: "Settled payments", review: "Needs review", recorded: "Recorded outside PayPal", test: "Test transfers" };
export const Route = createFileRoute("/_authenticated/admin-paypal")({
  validateSearch: (search: Record<string, unknown>): { view: PaymentGroup | "all" } => ({ view: typeof search.view === "string" && search.view in labels ? search.view as PaymentGroup : "all" }),
  loader: ({ context }) => context.queryClient.ensureQueryData(payoutDashboardOptions),
  head: () => ({ meta: [{ title: "Admin PayPal Dashboard | HousekeepingBooking.com" }, { name: "description", content: "Manage approved cleaner earnings, pending PayPal transfers and verified settled payments." }, { property: "og:title", content: "Admin PayPal Dashboard | HousekeepingBooking.com" }, { property: "og:description", content: "Review cleaner earnings and manually send PayPal payouts." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  pendingComponent: () => <div><AppHeader /><p role="status" className="mx-auto max-w-5xl px-6 py-10">Loading PayPal payments…</p></div>,
  errorComponent: PaymentError,
  notFoundComponent: () => <p>Payment dashboard not found.</p>,
  component: PayPalDashboard,
});
function PaymentError() { const router = useRouter(); return <div><AppHeader /><main className="mx-auto max-w-5xl px-6 py-10"><h1 className="text-2xl font-bold">PayPal dashboard unavailable</h1><p role="alert" className="my-4 text-destructive">Admin access is required. If you are an admin, try refreshing.</p><Button variant="outline" onClick={() => router.invalidate()}>Try again</Button></main></div>; }
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
function PayPalDashboard() {
  const payments = useSuspenseQuery(payoutDashboardOptions); const { view } = Route.useSearch();
  const getConfig = useServerFn(payoutConfig); const config = useQuery({ queryKey: ["payout-config"], queryFn: () => getConfig() });
  const rows = payments.data.filter(row => view === "all" || row.group === view);
  return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Button asChild variant="ghost" size="sm"><Link to="/admin"><ArrowLeft />Admin</Link></Button><h1 className="mt-3 text-3xl font-extrabold">PayPal dashboard</h1></div><div className="flex items-center gap-3"><span className="text-sm font-semibold text-primary">{config.data ? config.data.configured ? config.data.environment === "live" ? "Live PayPal" : "Test PayPal" : "PayPal not configured" : "Checking PayPal…"}</span><Button size="icon" variant="outline" title="Refresh payments" aria-label="Refresh payments" disabled={payments.isFetching} onClick={() => payments.refetch()}><RefreshCw /></Button></div></div>
    <div className="mt-8 grid gap-6 border-y border-border py-6 sm:grid-cols-3">{(["approved", "pending", "settled"] as const).map((group, index) => { const Icon = [Banknote, Clock, CheckCircle2][index] ?? Banknote; const matches = payments.data.filter(row => row.group === group); return <div key={group}><p className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{labels[group]}</p><p className="mt-2 text-3xl font-bold text-primary">{money(matches.reduce((sum, r) => sum + r.amount_cents, 0))}</p><p className="mt-1 text-xs text-muted-foreground">{matches.length} {group === "approved" ? "timesheets" : "payments"}</p></div>; })}</div>
    {payments.isRefetchError && <p role="alert" className="mt-4 text-destructive">Couldn’t refresh. Showing last loaded payments.</p>}
    {config.error && <p role="alert" className="mt-4 text-destructive">Couldn’t check PayPal configuration.</p>}
    <nav aria-label="Payment views" className="mt-6 flex flex-wrap gap-2">{(["all", ...Object.keys(labels)] as (PaymentGroup | "all")[]).map(group => <Button key={group} asChild variant={view === group ? "default" : "outline"} size="sm"><Link to="/admin-paypal" search={{ view: group }}>{group === "all" ? "All payments" : labels[group]}</Link></Button>)}</nav>
    {!rows.length && <section className="mt-8 border-y border-border py-10 text-center"><Banknote className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-4 text-lg font-bold">{view === "all" ? "No approved earnings or payments yet" : `No ${labels[view].toLowerCase()}`}</h2><Button asChild variant="outline" className="mt-4"><Link to="/admin">View timesheets in Admin</Link></Button></section>}
    <div className="mt-6 space-y-4">{rows.map(row => <article key={row.id} className="rounded-lg border border-border bg-card p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-bold">{row.cleaner}</h2><p className="mt-1 text-sm text-muted-foreground">{row.bookings?.service ?? "Cleaning visit"} · {row.bookings?.preferred_date} · {row.bookings?.time_window}</p></div><div><p className="text-xl font-bold text-primary">{money(row.amount_cents)}</p><p className="mt-1 text-sm font-semibold">{labels[row.group]}</p></div></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Approved work</dt><dd>{Math.floor(row.minutes / 60)}h {row.minutes % 60}m · {money(row.rate_cents)}/hr</dd></div><div><dt className="text-muted-foreground">PayPal recipient</dt><dd className="break-all">{row.transfer?.recipient_email ?? row.receivingEmail ?? "Receiving email not saved"}</dd></div></dl>
      {row.group === "settled" && row.paid_at && <p className="mt-4 text-sm text-primary">Settled {new Date(row.paid_at).toLocaleString()} · {row.payment_reference}</p>}
      {row.group === "recorded" && <p className="mt-4 break-words text-sm text-muted-foreground">Recorded {row.paid_at ? new Date(row.paid_at).toLocaleString() : ""} · {row.payment_reference}</p>}
      {row.group === "review" && <p className="mt-4 flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />Review the existing PayPal transfer before sending any further payment.</p>}
      {row.transfer?.paypal_batch_id && <p className="mt-3 break-all text-xs text-muted-foreground">PayPal batch: {row.transfer.paypal_batch_id}</p>}
      {(row.group !== "recorded") && <PayoutTransfer workId={row.id} cleanerId={row.cleaner_id} amount={row.amount_cents} admin={row.group === "approved"} />}
    </article>)}</div>
  </main></div>;
}