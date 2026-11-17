import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { BookingCard, type BookingRow } from "@/components/BookingCard";
import { useAuth } from "@/hooks/use-auth";
import { hoursSummary } from "@/lib/cleaner-hours";
import { useServerFn } from "@tanstack/react-start";
import { completeBooking } from "@/lib/booking.functions";
import { BookingScheduler } from "@/components/BookingScheduler";
import { Button } from "@/components/ui/button";
import { CalendarDays, Pencil, Phone, LayoutDashboard } from "lucide-react";
import { refreshBookingViews } from "@/lib/booking-sync";
import { slotLabel } from "@/lib/appointment-slots";
import { bookedSlot } from "@/lib/housekeeper-dashboard";
import { ServiceQuoteReview } from '@/components/ServiceQuoteReview';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TipPayments } from '@/components/TipPayments';
import { TimesheetList } from '@/components/TimesheetList';
import { PayoutAccount } from '@/components/PayoutAccount';
import { cleanerIncomeOptions } from '@/lib/cleaner-dashboard-query';

export const Route = createFileRoute("/_authenticated/cleaner")({
  head: () => ({
    meta: [
      { title: "Housekeeper Dashboard | HousekeepingBooking.com" },
      { name: "description", content: "Review pending quotes, confirmed appointments, earned tips and PayPal payments, and manage your housekeeper schedule." },
      { property: "og:title", content: "Housekeeper Dashboard | HousekeepingBooking.com" },
      { property: "og:description", content: "Your pending quotes, confirmed bookings, earned tips, payments and appointment schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CleanerJobs,
});

function CleanerJobs() {
  const { user, isCleaner, loading } = useAuth();
  const qc = useQueryClient();
  const jobs = useQuery({
    queryKey: ["cleaner-jobs", user?.id],
    refetchInterval: 15000,
    enabled: !!user && isCleaner,
    queryFn: async () => {
      if (!user) throw new Error("Sign in to view jobs.");
      const { data, error } = await supabase.from("bookings").select("*").eq("cleaner_id", user.id).order("preferred_date");
      if (error) throw error;
      return data as BookingRow[];
    },
  });
  const settings = useQuery({
    queryKey: ["cleaner-portal-settings", user?.id],
    enabled: !!user && isCleaner,
    queryFn: async () => {
      if (!user) throw new Error("Sign in to view availability.");
      const { data, error } = await supabase.from("cleaner_settings").select("hourly_rate_cents, accepting_jobs, service_areas, weekly_hours, unavailable_dates").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [showPast, setShowPast] = useState(false);
  const income = useQuery({ ...cleanerIncomeOptions(user?.id ?? ""), enabled: !!user && isCleaner });
  const quotes = useQuery({ queryKey: ["service-quote-reviews", user?.id], enabled: !!user && isCleaner, refetchInterval: 15000, queryFn: async () => {
    if (!user) throw new Error("Sign in required.");
    const { data, error } = await supabase.from("bookings").select("*").eq("cleaner_id", user.id).eq("status", "pending_payment").not("service_quote", "is", null).order("preferred_date");
    if (error) throw error;
    return data;
  } });
  const slots = useQuery({ queryKey: ["dashboard-slots", user?.id], enabled: !!user && isCleaner, refetchInterval: 15000, queryFn: async () => {
    if (!user) throw new Error("Sign in required.");
    const { data, error } = await supabase.from("cleaner_appointment_slots").select("*").eq("cleaner_id", user.id).eq("active", true).gte("slot_date", today).order("slot_date").order("start_time"); if (error) throw error; return data;
  } });
  const upcoming = (jobs.data ?? []).filter(b => b.status === "confirmed" && b.preferred_date >= today);
  const shown = showPast ? jobs.data ?? [] : upcoming;
  const completeFn = useServerFn(completeBooking);
  const complete = useMutation({
    mutationFn: async (id: string) => {
      const r = await completeFn({ data: { bookingId: id } });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => refreshBookingViews(qc),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold text-foreground">Housekeeper dashboard</h1>{isCleaner && <div className="flex flex-wrap items-center gap-3"><Button asChild variant="outline"><Link to="/cleaner-schedule"><CalendarDays />My schedule</Link></Button><Link to="/cleaner-profile" className="text-sm font-bold text-primary">Hours, rates & profile →</Link></div>}</div>
        {!loading && !isCleaner && <section className="mt-6 border-t border-border py-6"><h2 className="text-xl font-bold">Housekeeper application</h2><p className="mt-2 text-muted-foreground">Cleaner access begins after your application is approved.</p><Button asChild className="mt-4"><Link to="/apply">Apply or check hiring progress</Link></Button></section>}
        {isCleaner && settings.isSuccess && (
          <div className="mt-6 border-y border-border py-4 text-sm">
            {settings.data ? (<>
              <p className="font-bold text-foreground">${(settings.data.hourly_rate_cents / 100).toFixed(2)}/hr · {settings.data.accepting_jobs ? "Accepting new jobs" : "Not accepting new jobs"}{settings.data.service_areas ? ` · ${settings.data.service_areas}` : ""}</p>
              <p className="mt-1 text-muted-foreground">Hours: {hoursSummary(settings.data.weekly_hours)}</p>
              {settings.data.unavailable_dates.length > 0 && <p className="mt-1 text-muted-foreground">Days off: {settings.data.unavailable_dates.join(", ")}</p>}
            </>) : <p className="text-muted-foreground">You haven't set your rate or hours yet.</p>}
          </div>
        )}
        {isCleaner && <section className="mt-6 border-y border-border py-6"><dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div><dt className="text-sm text-muted-foreground">Pending quotes</dt><dd className="mt-1 text-2xl font-bold">{quotes.isSuccess ? quotes.data.length : "—"}</dd><p className="mt-1 text-xs text-muted-foreground">{quotes.isSuccess ? `${quotes.data.filter(b => !b.quote_reviewed_at).length} awaiting phone review` : "Loading quotes…"}</p></div>
          <div><dt className="text-sm text-muted-foreground">Confirmed upcoming</dt><dd className="mt-1 text-2xl font-bold">{jobs.isSuccess ? upcoming.length : "—"}</dd><p className="mt-1 text-xs text-muted-foreground">{upcoming.filter(b => b.preferred_date === today).length} today</p></div>
          <div><dt className="text-sm text-muted-foreground">Earned tips</dt><dd className="mt-1 text-2xl font-bold text-primary">{income.data ? `$${(income.data.confirmedTips / 100).toFixed(2)}` : "—"}</dd><p className="mt-1 text-xs text-muted-foreground">Customer-confirmed · live</p></div>
          <div><dt className="text-sm text-muted-foreground">Timesheet earnings</dt><dd className="mt-1 text-2xl font-bold">{income.data ? `$${(income.data.wages / 100).toFixed(2)}` : "—"}</dd><p className="mt-1 text-xs text-muted-foreground">Submitted, approved & paid</p></div>
        </dl>{(income.error || quotes.error) && <p role="alert" className="mt-4 text-destructive">{(income.error ?? quotes.error)?.message}</p>}</section>}
        {isCleaner && <Tabs defaultValue="bookings" className="mt-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="bookings">Bookings</TabsTrigger><TabsTrigger value="quotes">Pending quotes</TabsTrigger><TabsTrigger value="payments">Earnings & tips</TabsTrigger><TabsTrigger value="schedule">Schedule & slots</TabsTrigger>
          </TabsList>
          <TabsContent value="schedule">
        
        {isCleaner && <section className="mt-8 border-t border-border py-6"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">Appointment slots</h2><Button asChild variant="outline"><Link to="/availability">Create or move slots</Link></Button></div>{slots.error && <p role="alert" className="mt-3 text-destructive">{slots.error.message}</p>}<div className="mt-4 divide-y divide-border">{slots.data?.map(slot => { const b = bookedSlot(slot, jobs.data ?? []); return <article key={slot.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 break-words"><p className="font-semibold">{slot.slot_date} · {slotLabel(slot)}</p><p className="mt-1 text-sm text-muted-foreground">{b ? `Booked · ${b.customer_name}` : "Available"}</p>{b && <><p className="mt-1 text-sm">{b.address}</p><p className="mt-1 break-all text-sm text-muted-foreground">{b.phone} · {b.email}</p></>}</div>{b && <Button asChild variant="outline"><Link to="/appointment/$id" params={{ id: b.id }}>View client</Link></Button>}</article>; })}</div>{slots.isSuccess && slots.data.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No upcoming slot listings.</p>}</section>}
        <section className="mt-8 border-t border-border py-6"><h2 className="mb-4 text-xl font-bold">Appointment calendar</h2><BookingScheduler /></section>
        </TabsContent>
        <TabsContent value="quotes">{user && <ServiceQuoteReview userId={user.id}/>}</TabsContent>
        <TabsContent value="payments">{user && <>
          <section className="mt-6 border-b border-border pb-6"><h2 className="text-xl font-bold">Payment overview</h2>{income.isPending && <p role="status" className="mt-3">Loading payments…</p>}{income.data && <dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3">{[["Wages delivered by PayPal", income.data.settledWages], ["Tips delivered by PayPal", income.data.settledTips], ["Earned, not PayPal-settled", income.data.total - income.data.settledTotal]].map(([label, cents]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-bold">${(Number(cents) / 100).toFixed(2)}</dd></div>)}</dl>}</section>
          <PayoutAccount userId={user.id}/><TipPayments userId={user.id}/><TimesheetList userId={user.id}/>
        </>}</TabsContent>
        <TabsContent value="bookings">
        <Button asChild variant="outline" className="mt-6"><Link to="/staff-dashboard" search={{ from: "", to: "", cleaner: "all", view: "all" }}><LayoutDashboard />Staff dashboard</Link></Button>
        {isCleaner && <div className="mt-6 flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/phone-booking"><Phone />Phone bookings</Link></Button><Button asChild variant="outline"><Link to="/my-page"><Pencil />Edit my public page</Link></Button><Button asChild><Link to="/waiting-list">Choose from waiting list</Link></Button><Button asChild variant="outline"><Link to="/timesheets">Timesheets & payments</Link></Button></div>}
        {jobs.isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {(jobs.error || complete.error) && <p role="alert" className="mt-4 text-destructive">{(jobs.error ?? complete.error)?.message}</p>}
        {jobs.data?.length === 0 && <p className="mt-6 rounded-xl bg-muted p-6 text-muted-foreground">No jobs assigned yet.</p>}
        <div className="mt-6 space-y-3">
          {isCleaner && <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{showPast ? "All appointments" : "Upcoming appointments"}</h2><Button variant="outline" onClick={() => setShowPast(!showPast)}>{showPast ? "Upcoming only" : "Include past visits"}</Button></div>}
          {jobs.isSuccess && shown.length === 0 && jobs.data.length > 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
          {shown.map((b) => (
            <article key={b.id}>
            <BookingCard b={b} showCustomer cleanerPayment>
              <Button asChild variant="outline"><Link to="/appointment/$id" params={{ id: b.id }}>Open appointment</Link></Button>
              {b.status === "confirmed" && (
                <Button onClick={() => complete.mutate(b.id)} disabled={complete.isPending}>Mark completed</Button>
              )}
            </BookingCard>

            </article>
          ))}
        </div>
        </TabsContent></Tabs>}
      </main>
    </div>
  );
}
