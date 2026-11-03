import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Phone, Mail, Save, Plus, ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { CleaningLevelPicker } from "@/components/CleaningLevelPicker";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { type BookingFormInput } from "@/lib/booking-input";
import { phoneBookingSchema } from "@/lib/phone-booking";
import { savePhoneBooking, sendPhoneEstimate } from "@/lib/phone-booking.functions";
import { ADD_ONS, FREQUENCIES, SERVICE_AREAS, SERVICE_BASE, TIME_WINDOWS, quote } from "@/lib/pricing";
import { refreshBookingViews } from "@/lib/booking-sync";

export const Route = createFileRoute("/_authenticated/phone-booking")({
  head: () => ({ meta: [
    { title: "Staff Phone Bookings | HousekeepingBooking.com" },
    { name: "description", content: "Take customer bookings by phone and send their requested cleaning estimate." },
    { property: "og:title", content: "Staff Phone Bookings | HousekeepingBooking.com" },
    { property: "og:description", content: "Manage caller details, estimates and requested cleaning appointments." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }), component: PhoneBooking,
});
const blank = (): BookingFormInput => ({ customerName: "", email: "", phone: "", address: "", serviceArea: SERVICE_AREAS[0] ?? "", service: "Standard Housekeeping", frequency: "One-time", bedrooms: 2, bathrooms: 1, addOns: [], rush: false, cleaningLevel: "Light", preferredDate: "", timeWindow: TIME_WINDOWS[0] ?? "", notes: "" });
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
function PhoneBooking() {
  const { user, isAdmin, isCleaner, loading } = useAuth();
  const qc = useQueryClient();
  const allowed = isAdmin || isCleaner;
  const [form, setForm] = useState<BookingFormInput>(blank);
  const [savedId, setSavedId] = useState("");
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const saveFn = useServerFn(savePhoneBooking);
  const emailFn = useServerFn(sendPhoneEstimate);
  const total = quote(form);
  const rows = useQuery({
    queryKey: ["phone-bookings", user?.id, isAdmin], enabled: Boolean(user) && allowed, refetchInterval: 15000,
    queryFn: async () => {
      if (!user) throw new Error("Sign in required.");
      let query = supabase.from("bookings").select("id, customer_name, email, service, preferred_date, time_window, amount_cents, status, created_by_staff, access_token").not("created_by_staff", "is", null).order("created_at", { ascending: false }).limit(50);
      if (!isAdmin) query = query.eq("created_by_staff", user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  const email = useMutation({ mutationFn: (bookingId: string) => emailFn({ data: { bookingId } }), onSuccess: result => setMessage(result.message) });
  const save = useMutation({
    mutationFn: (sendEmail: boolean) => saveFn({ data: phoneBookingSchema.parse(form) }).then(booking => ({ booking, sendEmail })),
    onSuccess: async ({ booking, sendEmail }) => {
      setSavedId(booking.id); setMessage(`Phone booking saved · ${money(booking.amount_cents)} per visit. Awaiting customer checkout.`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["phone-bookings"] }), refreshBookingViews(qc)]);
      if (sendEmail) email.mutate(booking.id);
    },
  });
  function submit(sendEmail: boolean) {
    setMessage(""); setValidationError("");
    const parsed = phoneBookingSchema.safeParse(form);
    if (!parsed.success) { setValidationError("Complete the customer details and choose an appointment date before saving."); return; }
    save.mutate(sendEmail);
  }
  const input = "mt-2 w-full min-w-0 rounded-md border border-input bg-background px-3 py-3 text-base font-normal";
  const busy = save.isPending || email.isPending;
  return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="flex items-center gap-3 text-3xl font-bold"><Phone className="h-7 w-7 shrink-0 text-primary" />Phone bookings</h1><Button variant="outline" onClick={() => { setForm(blank()); setSavedId(""); setMessage(""); setValidationError(""); }} disabled={busy}><Plus />New caller</Button></div>
    {loading ? <p className="mt-6">Loading…</p> : !allowed ? <p className="mt-6">Staff access required.</p> : <>
      <form className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]" onSubmit={e => { e.preventDefault(); submit(false); }}>
        <fieldset disabled={busy || Boolean(savedId)} className="min-w-0 space-y-6">
          <section className="border-t border-border pt-5"><h2 className="text-xl font-bold">Customer details</h2><div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
            {([{ key: "customerName", label: "Customer name", type: "text", max: 100 }, { key: "email", label: "Customer email", type: "email", max: 255 }, { key: "phone", label: "Customer phone", type: "tel", max: 30 }, { key: "address", label: "Cleaning address", type: "text", max: 300 }] as const).map(f => <label key={f.key} className="min-w-0 text-sm font-semibold">{f.label}<input required type={f.type} maxLength={f.max} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className={input} /></label>)}
          </div></section>
          <section className="border-t border-border pt-5"><h2 className="text-xl font-bold">Cleaning</h2><div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-semibold">Service area<select className={input} value={form.serviceArea} onChange={e => setForm({ ...form, serviceArea: e.target.value })}>{SERVICE_AREAS.map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="min-w-0 text-sm font-semibold">Service<select className={input} value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>{Object.keys(SERVICE_BASE).map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="min-w-0 text-sm font-semibold">Frequency<select className={input} value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>{FREQUENCIES.map(s => <option key={s}>{s}</option>)}</select></label>
            <div className="grid min-w-0 grid-cols-2 gap-3">{(["bedrooms", "bathrooms"] as const).map(key => <label key={key} className="min-w-0 text-sm font-semibold">{key === "bedrooms" ? "Bedrooms" : "Bathrooms"}<input required type="number" min={1} max={10} value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} className={input} /></label>)}</div>
          </div><div className="mt-5"><CleaningLevelPicker value={form.cleaningLevel} onChange={cleaningLevel => setForm({ ...form, cleaningLevel })} /></div></section>
          <fieldset className="border-t border-border pt-5"><legend className="text-xl font-bold">Add-ons</legend><div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.keys(ADD_ONS).map(name => <label key={name} className="flex min-w-0 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 shrink-0" checked={form.addOns.includes(name)} onChange={e => setForm({ ...form, addOns: e.target.checked ? [...form.addOns, name] : form.addOns.filter(a => a !== name) })} /><span className="break-words">{name}{form.addOns.includes(name) && total.freeAddOns.includes(name) ? " · Included" : ""}</span></label>)}</div><label className="mt-5 flex items-center gap-3 text-sm"><input type="checkbox" checked={form.rush} onChange={e => setForm({ ...form, rush: e.target.checked })} />Rush dispatch · +$15</label></fieldset>
          <AppointmentCalendar date={form.preferredDate} timeWindow={form.timeWindow} onChange={(preferredDate, timeWindow) => setForm({ ...form, preferredDate, timeWindow })} />
          <label className="block text-sm font-semibold">Customer notes<textarea rows={3} maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={input} /></label>
        </fieldset>
        <aside className="min-w-0 border-t border-border pt-5 lg:sticky lg:top-6 lg:self-start"><h2 className="text-xl font-bold">Estimate per visit</h2><p className="mt-3 text-4xl font-bold text-primary">{money(total.totalCents)}</p><dl className="mt-5 space-y-3 text-sm">{[{ label: "Base cleaning", value: total.base }, { label: "Extra rooms", value: total.rooms }, { label: `${form.cleaningLevel} level`, value: total.cleaningLevel }, { label: "Add-ons", value: total.addOns }, { label: "Rush", value: total.rush }].map(line => <div key={line.label} className="flex justify-between gap-3"><dt>{line.label}</dt><dd>{money(line.value * 100)}</dd></div>)}</dl><p className="mt-5 text-sm text-muted-foreground">$0 upfront · charged after each cleaning</p><p className="mt-2 text-sm text-muted-foreground">Requested appointment · awaiting customer checkout</p>
          <div className="mt-6 grid gap-3">{savedId ? <Button type="button" disabled={busy} onClick={() => email.mutate(savedId)}><Mail />{email.isPending ? "Sending…" : "Send estimate email"}</Button> : <><Button type="submit" disabled={busy}><Save />{save.isPending ? "Saving…" : "Save phone booking"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => submit(true)}><Mail />Save & email estimate</Button></>}</div>
          {message && <p role="status" className="mt-4 break-words text-sm text-primary">{message}</p>}{(validationError || save.error || email.error) && <p role="alert" className="mt-4 text-sm text-destructive">{validationError || save.error?.message || email.error?.message}</p>}
        </aside>
      </form>
      <section className="mt-12 border-t border-border pt-6"><h2 className="text-xl font-bold">Recent phone bookings</h2>{rows.error && <p role="alert" className="mt-4 text-destructive">{rows.error.message}</p>}{rows.isPending ? <p className="mt-4">Loading bookings…</p> : rows.data?.length === 0 ? <p className="mt-4 text-muted-foreground">No phone bookings yet.</p> : <div className="mt-5 divide-y divide-border">{rows.data?.map(b => <article key={b.id} className="flex min-w-0 flex-wrap items-start justify-between gap-4 py-5"><div className="min-w-0"><h3 className="break-words font-bold">{b.customer_name} · {money(b.amount_cents)}</h3><p className="mt-1 break-all text-sm text-muted-foreground">{b.email}</p><p className="mt-1 break-words text-sm">{b.service} · {b.preferred_date} · {b.time_window}</p><p className="mt-2 text-sm font-semibold text-primary">{b.status === "pending_payment" ? "Awaiting customer checkout" : b.status === "confirmed" ? "Confirmed" : b.status === "completed" ? "Completed" : "Cancelled"}</p></div><div className="flex flex-wrap gap-2">{b.status === "pending_payment" && <Button variant="outline" disabled={busy} onClick={() => email.mutate(b.id)}><Mail />Send estimate</Button>}<Button asChild variant="outline"><Link to="/booking/$id" params={{ id: b.id }} search={{ t: b.access_token }}><ExternalLink />View booking</Link></Button></div></article>)}</div>}</section>
    </>}
  </main></div>;
}
