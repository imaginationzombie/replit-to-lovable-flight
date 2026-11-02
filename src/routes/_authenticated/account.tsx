import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { BookingCard, type BookingRow } from "@/components/BookingCard";
import { customerBookingsOptions } from "@/lib/customer-bookings";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My Account | HousekeepingBooking.com" },
      { name: "description", content: "Your bookings and profile." },
      { property: "og:title", content: "My Account | HousekeepingBooking.com" },
      { property: "og:description", content: "Your bookings and profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});

function Account() {
  const qc = useQueryClient();
  const bookings = useQuery(customerBookingsOptions);
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ full_name: "", phone: "", address: "" });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (profile.data) setForm({ full_name: profile.data.full_name, phone: profile.data.phone, address: profile.data.address });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const clean = { full_name: form.full_name.trim().slice(0, 100), phone: form.phone.trim().slice(0, 30), address: form.address.trim().slice(0, 300) };
      const { error } = await supabase.from("profiles").update(clean).eq("id", profile.data!.id);
      if (error) throw error;
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); qc.invalidateQueries({ queryKey: ["my-profile"] }); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (bookings.data ?? []).filter((b) => b.preferred_date >= today && b.status !== "completed" && b.status !== "cancelled");
  const past = (bookings.data ?? []).filter((b) => !upcoming.includes(b));
  const field = "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold text-foreground">My bookings</h1>
            <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/booking-status">Booking status</Link></Button><Button asChild><Link to="/book">Book a cleaning</Link></Button></div>
          </div>
          {bookings.isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
          {bookings.error && <p className="mt-6 text-destructive">Couldn't load your bookings.</p>}
          {bookings.data && bookings.data.length === 0 && (
            <p className="mt-6 rounded-xl bg-muted p-6 text-center text-muted-foreground">No bookings yet. Try the <Link to="/booking-assistant" className="text-primary underline">AI assistant</Link> to get started.</p>
          )}
          {upcoming.length > 0 && <h2 className="mt-6 text-sm font-bold uppercase text-muted-foreground">Upcoming</h2>}
          <div className="mt-3 space-y-3">{upcoming.map((b) => <BookingCard key={b.id} b={b} />)}</div>
          {past.length > 0 && <h2 className="mt-8 text-sm font-bold uppercase text-muted-foreground">Past</h2>}
          <div className="mt-3 space-y-3">{past.map((b) => <BookingCard key={b.id} b={b} />)}</div>
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-foreground">Profile</h2>
          <p className="text-sm text-muted-foreground">{profile.data?.email}</p>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-foreground">Full name<input maxLength={100} className={field} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
            <label className="block text-sm font-semibold text-foreground">Phone<input type="tel" maxLength={30} className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="block text-sm font-semibold text-foreground">Home address<input maxLength={300} className={field} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            {save.error && <p className="text-sm text-destructive">Couldn't save. Please try again.</p>}
            <button disabled={save.isPending || !profile.data} className="w-full rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground disabled:opacity-60">
              {saved ? "Saved!" : save.isPending ? "Saving…" : "Save profile"}
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}
