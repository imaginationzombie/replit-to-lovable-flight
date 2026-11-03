import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { publicPortfolio } from "@/lib/portfolio.functions";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authorizeOrder, createOrder, getPaypalConfig } from "@/lib/booking.functions";
import { ADD_ONS, FREQUENCIES, SERVICE_AREAS, SERVICE_BASE, TIME_WINDOWS, matchAddOns, quote, addOnPrice } from "@/lib/pricing";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>): { housekeeper?: string } => {
    const housekeeper = z.string().uuid().optional().catch(undefined).parse(search["housekeeper"]);
    return housekeeper ? { housekeeper } : {};
  },
  head: () => ({
    meta: [
      { title: "Book Your Cleaning | HousekeepingBooking.com" },
      { name: "description", content: "Confirm your cleaning details and reserve with PayPal — $0 charged until after your cleaning." },
      { property: "og:title", content: "Book Your Cleaning | HousekeepingBooking.com" },
      { property: "og:description", content: "Confirm your cleaning details and reserve with PayPal — $0 charged until after your cleaning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookPage,
});

const DRAFT_KEY = "hkb-booking-draft";

type Form = {
  customerName: string; email: string; phone: string; address: string; serviceArea: string;
  service: string; frequency: string; bedrooms: number; bathrooms: number; addOns: string[];
  rush: boolean; preferredDate: string; timeWindow: string; notes: string;
  requestedCleanerId?: string | undefined;
};

const empty: Form = {
  customerName: "", email: "", phone: "", address: "", serviceArea: SERVICE_AREAS[0] ?? "",
  service: "Standard Housekeeping", frequency: "One-time", bedrooms: 2, bathrooms: 1, addOns: [],
  rush: false, preferredDate: "", timeWindow: TIME_WINDOWS[0] ?? "", notes: "",
};

declare global {
  interface Window { paypal?: { Buttons: (o: unknown) => { render: (el: HTMLElement) => Promise<void>; close?: () => void } } }
}

function BookPage() {
  const { housekeeper } = Route.useSearch();
  const [housekeeperName, setHousekeeperName] = useState<string | null>(null);
  const portfolio = useServerFn(publicPortfolio);
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(empty);
  const [fromAi, setFromAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;
  const paypalRef = useRef<HTMLDivElement>(null);
  const create = useServerFn(createOrder);
  const capture = useServerFn(authorizeOrder);
  const config = useServerFn(getPaypalConfig);

  useEffect(() => {
    let cancelled = false;
    setForm(f => ({ ...f, requestedCleanerId: housekeeper }));
    setHousekeeperName(null);
    if (housekeeper) portfolio({ data: { id: housekeeper } }).then(p => {
      if (cancelled) return;
      if (!p) { setError("This housekeeper page is unavailable."); return; }
      setHousekeeperName(p.display_name);
    }).catch(() => { if (!cancelled) setError("Couldn't load your selected housekeeper."); });
    return () => { cancelled = true; };
  }, [housekeeper, portfolio]);

  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const r = JSON.parse(raw);
      const area = SERVICE_AREAS.find((a) => r.serviceArea && a.toLowerCase().includes(String(r.serviceArea).toLowerCase().split(/[ ,]/)[0] ?? ""));
      const tw = TIME_WINDOWS.find((t) => String(r.preferredTimeWindow ?? "").toLowerCase().includes((t.split(" ")[0] ?? "").toLowerCase()));
      setForm((f) => ({
        ...f,
        service: r.service in SERVICE_BASE ? r.service : f.service,
        frequency: FREQUENCIES.includes(r.frequency) ? r.frequency : f.frequency,
        bedrooms: Math.min(10, Math.max(1, Math.round(r.bedrooms) || f.bedrooms)),
        bathrooms: Math.min(10, Math.max(1, Math.round(r.bathrooms) || f.bathrooms)),
        addOns: r.source === "estimator" ? (r.addOns ?? []).filter((a: string) => a in ADD_ONS) : matchAddOns(r.addOns ?? []),
        serviceArea: area ?? f.serviceArea,
        timeWindow: tw ?? f.timeWindow,
        notes: [r.specialNotes, r.preferredDay ? `Preferred day: ${r.preferredDay}` : ""].filter(Boolean).join("\n").slice(0, 1000),
      }));
      setFromAi(r.source !== "estimator");
    } catch { /* ignore bad draft */ }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name, phone, address, email").eq("id", u.user.id).maybeSingle();
      if (!p) return;
      setForm((f) => ({
        ...f,
        customerName: f.customerName || p.full_name,
        phone: f.phone || p.phone,
        address: f.address || p.address,
        email: f.email || p.email,
      }));
    })();
  }, []);

  const valid =
    form.customerName.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && form.phone.trim().length >= 7 &&
    form.address.trim().length >= 5 && !!form.preferredDate && (!housekeeper || !!housekeeperName);
  const validRef = useRef(valid);
  validRef.current = valid;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await config();
      if (!cfg.ok) { setError(cfg.error); return; }
      if (!window.paypal) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.data.clientId)}&currency=USD&intent=authorize`;
          s.onload = () => resolve();
          s.onerror = () => reject();
          document.body.appendChild(s);
        }).catch(() => setError("Couldn't load PayPal. Please refresh."));
      }
      if (cancelled || !window.paypal || !paypalRef.current) return;
      paypalRef.current.innerHTML = "";
      await window.paypal.Buttons({
        style: { layout: "vertical", shape: "rect", label: "checkout" },
        onClick: (_: unknown, actions: { reject: () => void; resolve: () => void }) => {
          if (!validRef.current) { setError("Please fill in your contact details and date first."); return actions.reject(); }
          setError(null);
          return actions.resolve();
        },
        createOrder: async () => {
          const res = await create({ data: formRef.current });
          if (!res.ok) { setError(res.error); throw new Error(res.error); }
          return res.data.orderId;
        },
        onApprove: async (d: { orderID: string }) => {
          setPaying(true);
          const res = await capture({ data: { orderId: d.orderID } });
          if (!res.ok) { setPaying(false); setError(res.error); return; }
          sessionStorage.removeItem(DRAFT_KEY);
          navigate({ to: "/booking/$id", params: { id: res.data.bookingId }, search: { t: res.data.token } });
        },
        onError: () => setError("PayPal ran into a problem. Please try again."),
      }).render(paypalRef.current);
      setReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = quote(form);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const field = "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
  const label = "text-sm font-semibold text-foreground";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Book your cleaning</h1>
        {housekeeper && <p className="mt-3 text-lg font-semibold text-primary">{housekeeperName ? `Your housekeeper: ${housekeeperName}` : "Loading selected housekeeper…"}</p>}
        {fromAi && <p className="mt-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">We filled this in from your assistant recommendation — check it over and adjust anything.</p>}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0 space-y-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <section className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className={label}>Service</span>
                <select className={field} value={form.service} onChange={(e) => set("service", e.target.value)}>
                  {Object.entries(SERVICE_BASE).map(([s, p]) => <option key={s} value={s}>{s} — from ${p}</option>)}
                </select></label>
              <label><span className={label}>Bedrooms</span>
                <input type="number" min={1} max={10} className={field} value={form.bedrooms} onChange={(e) => set("bedrooms", Math.min(10, Math.max(1, +e.target.value || 1)))} /></label>
              <label><span className={label}>Bathrooms</span>
                <input type="number" min={1} max={10} className={field} value={form.bathrooms} onChange={(e) => set("bathrooms", Math.min(10, Math.max(1, +e.target.value || 1)))} /></label>
              <label><span className={label}>How often</span>
                <select className={field} value={form.frequency} onChange={(e) => set("frequency", e.target.value)}>
                  {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select></label>
              <label><span className={label}>Area</span>
                <select className={field} value={form.serviceArea} onChange={(e) => set("serviceArea", e.target.value)}>
                  {SERVICE_AREAS.map((a) => <option key={a}>{a}</option>)}</select></label>
            </section>

            <AppointmentCalendar date={form.preferredDate} timeWindow={form.timeWindow}
              onChange={(preferredDate, timeWindow) => setForm((f) => ({ ...f, preferredDate, timeWindow }))} />

            <section>
              <p className={label}>Add-ons <span className="font-normal text-muted-foreground">— 1 free per hour of cleaning ({q.includedHours} included), most expensive first</span></p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {Object.entries(ADD_ONS).map(([a, p]) => (
                  <label key={a} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={form.addOns.includes(a)} onChange={(e) => set("addOns", e.target.checked ? [...form.addOns, a] : form.addOns.filter((x) => x !== a))} />
                      {a}</span>
                    <span className="text-muted-foreground">{q.freeAddOns.includes(a) ? <b className="text-primary">Included</b> : <><s className="mr-1 opacity-60">${p}</s><b className="text-primary">+${addOnPrice(a).toFixed(2)}</b></>}</span>
                  </label>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.rush} onChange={(e) => set("rush", e.target.checked)} />
                Same-day rush dispatch (+$15)</label>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <label><span className={label}>Full name</span><input className={field} maxLength={100} value={form.customerName} onChange={(e) => set("customerName", e.target.value)} /></label>
              <label><span className={label}>Phone</span><input type="tel" className={field} maxLength={30} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
              <label className="sm:col-span-2"><span className={label}>Email</span><input type="email" className={field} maxLength={255} value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
              <label className="sm:col-span-2"><span className={label}>Service address</span><input className={field} maxLength={300} value={form.address} onChange={(e) => set("address", e.target.value)} /></label>
              <label className="sm:col-span-2"><span className={label}>Notes for your cleaner</span>
                <textarea rows={3} maxLength={1000} className={field} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
            </section>
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-6">
            <h2 className="text-lg font-bold text-foreground">Your total</h2>
            {form.preferredDate && <p className="mt-2 text-sm text-muted-foreground">{form.preferredDate} · {form.timeWindow}</p>}
            <dl className="mt-4 space-y-2 text-sm">
              <Row k={form.service} v={q.base} />
              {q.rooms > 0 && <Row k="Extra rooms" v={q.rooms} />}
              {q.addOns > 0 && <Row k={`Add-ons (${form.addOns.length})`} v={q.addOns} />}
              <p className="text-xs font-semibold text-primary">{q.includedHours} hr clean includes {q.includedHours} free add-on{q.includedHours === 1 ? "" : "s"}{q.freeAddOns.length ? ` (${q.freeAddOns.length} used)` : ""}. Extra add-ons 50% off.</p>
              {q.rush > 0 && <Row k="Rush dispatch" v={q.rush} />}
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="font-semibold text-foreground">Total</span>
              <span className="text-3xl font-extrabold text-primary">${q.total.toFixed(2)}</span>
            </div>
            <p className="mt-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">$0 charged today. PayPal holds this amount for your first visit and we only charge it after your cleaning is done.{form.frequency !== "One-time" ? " Each repeat visit is charged automatically to the same PayPal account after that cleaning." : ""}</p>
            {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {paying && <p className="mt-4 text-sm text-muted-foreground">Confirming your booking…</p>}
            <div ref={paypalRef} className="mt-5 min-h-12" />
            {!ready && !error && <p className="text-xs text-muted-foreground">Loading PayPal…</p>}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold text-foreground">${v.toFixed(2)}</dd></div>;
}
