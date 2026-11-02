import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { fetchBooking } from "@/lib/booking.functions";

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
      { title: "Booking Confirmed | HousekeeperBooking.com" },
      { name: "description", content: "Your cleaning booking details." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Booking Confirmed | HousekeeperBooking.com" },
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
  const confirmed = b.status === "confirmed";
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-sm">
        <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
          {confirmed ? "Paid & confirmed" : "Awaiting payment"}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-foreground">
          {confirmed ? `You're booked, ${b.customer_name.split(" ")[0]}!` : "Booking not paid yet"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {confirmed ? `We'll send updates to ${b.email}. Save this page link to view your booking anytime.` : "Your payment hasn't completed."}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Item k="Service" v={b.service} />
          <Item k="How often" v={b.frequency} />
          <Item k="Date" v={new Date(b.preferred_date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} />
          <Item k="Time" v={b.time_window} />
          <Item k="Home" v={`${b.bedrooms} bed / ${b.bathrooms} bath`} />
          <Item k="Area" v={b.service_area} />
          <Item k="Address" v={b.address} />
          <Item k="Paid" v={`$${(b.amount_cents / 100).toFixed(2)}`} />
        </dl>
        {b.add_ons.length > 0 && <p className="mt-4 text-sm text-foreground"><strong>Add-ons:</strong> {b.add_ons.join(", ")}{b.rush ? ", Rush dispatch" : ""}</p>}
        {b.notes && <p className="mt-2 whitespace-pre-line text-sm text-foreground"><strong>Notes:</strong> {b.notes}</p>}
        <p className="mt-6 text-xs text-muted-foreground">Booking #{b.id.slice(0, 8).toUpperCase()} • Questions? Call (814) 952-1964</p>
        <a href="/index.html" className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Back to home</a>
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold text-foreground">{v}</dd></div>;
}
