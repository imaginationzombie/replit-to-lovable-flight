import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { fetchBooking } from "@/lib/booking.functions";
import { PayBalance } from "@/components/PayBalance";
import { LeaveTip } from "@/components/LeaveTip";
import { canTip } from "@/lib/tips";
import { EstimateCheckout } from "@/components/EstimateCheckout";
import { GiftCredit } from "@/components/GiftCredit";
import { bookingBalance } from "@/lib/gift-certificates";
import { slotLabel } from "@/lib/appointment-slots";
import { ServiceQuotePayment } from '@/components/ServiceQuotePayment';
import { canPayServiceQuote } from '@/lib/service-quote';

export const Route = createFileRoute("/booking/$id")({
  validateSearch: z.object({ t: z.string().catch("") }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ params, deps }) => {
    if (!/^[0-9a-f-]{36}$/.test(params.id) || !/^[0-9a-f-]{36}$/.test(deps.t)) throw notFound();
    const b = await fetchBooking({ data: { id: params.id, token: deps.t } });
    if (!b) throw notFound();
    return b;
  },
  head: () => ({
    meta: [
      { title: "Your Cleaning Booking & Estimate | HousekeepingBooking.com" },
      { name: "description", content: "Your cleaning booking details." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your Cleaning Booking & Estimate | HousekeepingBooking.com" },
      { property: "og:description", content: "Your cleaning booking details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div><h1 className="text-2xl font-bold text-foreground">Booking not found</h1>
        <a href="/index.html" className="mt-4 inline-block text-primary underline">Back home</a></div>
    </div>
  ),
  component: Confirmation,
});

function Confirmation() {
  const b = Route.useLoaderData();
  const { t } = Route.useSearch();
  const confirmed = b.status === "confirmed" || b.status === "completed";
  const due = b.status === "completed" && !b.paid_at;
  const serviceQuote = Boolean(b.service_quote);
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl rounded-md border border-border bg-card p-4 shadow-sm sm:p-8">
        <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
          {b.paid_at ? "Paid" : serviceQuote ? b.quote_reviewed_at ? 'Phone review approved · awaiting payment' : 'Awaiting housekeeper phone review' : due ? "Payment due" : confirmed ? "Confirmed · $0 charged" : "Awaiting checkout"}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-foreground">
          {serviceQuote && b.status === 'pending_payment' ? 'Your service quote request' : due ? "Your cleaning is done!" : confirmed ? `You're booked, ${b.customer_name.split(" ")[0]}!` : b.status === "pending_payment" ? "Your cleaning estimate" : "Booking not active"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {b.paid_at ? "Your visit payment is complete. Thank you!" : serviceQuote && b.status==='pending_payment' ? b.quote_reviewed_at ? 'Your housekeeper approved the quote after phone review. Pay the estimate below to confirm this appointment.' : 'Your housekeeper will call to review the scope, crew and estimate. Your appointment request is saved, but not confirmed. Payment opens after approval.' : due ? "Please pay for your visit below." : confirmed ? "Nothing has been charged. Your visit is charged through PayPal only after the cleaning." : b.status === "pending_payment" ? "Review your estimate and approve your PayPal payment method below. Your requested appointment is not confirmed until checkout is complete." : "Contact us about this booking."}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Item k="Service" v={b.service} />
          {!serviceQuote && <Item k="Cleaning level" v={b.cleaning_level} />}
          <Item k="How often" v={b.frequency} />
          <Item k="Date" v={new Date(b.preferred_date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} />
          <Item k="Time" v={b.appointment_start && b.appointment_end ? slotLabel({ start_time: b.appointment_start, end_time: b.appointment_end }) : b.time_window} />
          {!serviceQuote && <Item k="Home" v={`${b.bedrooms} bed / ${b.bathrooms} bath`} />}
          <Item k="Area" v={b.service_area} />
          <Item k="Address" v={b.address} />
          <Item k={b.paid_at ? "Paid" : serviceQuote ? 'Estimate for this appointment' : "Charged after cleaning"} v={`$${(b.amount_cents / 100).toFixed(2)}`} />
        </dl>
        {!!b.gift_credit_cents && <p className="mt-4 text-primary">Gift credit: ${(b.gift_credit_cents / 100).toFixed(2)} · Remaining balance: ${(bookingBalance(b) / 100).toFixed(2)}</p>}
        {confirmed && !b.paid_at && !b.payment_checkout_started && <GiftCredit id={b.id} token={t} />}
        {due && bookingBalance(b) > 0 && <PayBalance id={b.id} token={t} />}
        {!serviceQuote && b.status === "pending_payment" && <EstimateCheckout id={b.id} token={t} />}
        {serviceQuote && canPayServiceQuote(b) && <ServiceQuotePayment id={b.id} token={t} amount={b.amount_cents}/>}
        {serviceQuote && b.quote_review_notes && <p className="mt-4 whitespace-pre-line text-sm"><strong>Phone review:</strong> {b.quote_review_notes}</p>}
        {canTip(b) && <LeaveTip id={b.id} token={t} />}
        {b.add_ons.length > 0 && <p className="mt-4 text-sm text-foreground"><strong>Add-ons:</strong> {b.add_ons.join(", ")}{b.rush ? ", Rush dispatch" : ""}</p>}
        {b.notes && <p className="mt-2 whitespace-pre-line text-sm text-foreground"><strong>Notes:</strong> {b.notes}</p>}
        <p className="mt-6 text-xs text-muted-foreground">Booking #{b.id.slice(0, 8).toUpperCase()} • Questions? Call (814) 952-1964</p>
        <a href="/index.html" className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Back to home</a>
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return <div className="min-w-0 rounded-md bg-muted p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-words font-semibold text-foreground">{v}</dd></div>;
}
