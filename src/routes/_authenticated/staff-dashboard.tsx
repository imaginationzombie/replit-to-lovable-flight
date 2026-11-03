import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Phone, Mail, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { BookingScheduler } from "@/components/BookingScheduler";
import { type BookingRow, fmtDate } from "@/components/BookingCard";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { filterStaffBookings } from "@/lib/staff-dashboard";
import { sendPhoneEstimate } from "@/lib/phone-booking.functions";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/staff-dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({ from: typeof search['from'] === "string" ? search['from'] : "", to: typeof search['to'] === "string" ? search['to'] : "", cleaner: typeof search['cleaner'] === "string" ? search['cleaner'] : "all", view: typeof search['view'] === "string" ? search['view'] : "all" }),
  head: () => ({ meta: [
    { title: "Staff Booking Dashboard | HousekeepingBooking.com" },
    { name: "description", content: "View phone estimates and scheduled cleaning visits by date and housekeeper." },
    { property: "og:title", content: "Staff Booking Dashboard | HousekeepingBooking.com" },
    { property: "og:description", content: "Manage staff-visible bookings, estimates and appointment calendars." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }), component: StaffDashboard,
});
function StaffDashboard() {
  const { user, isAdmin, isCleaner, loading } = useAuth();
  const allowed = isAdmin || isCleaner;
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const [message, setMessage] = useState("");
  const send = useServerFn(sendPhoneEstimate);
  const email = useMutation({ mutationFn: (bookingId: string) => send({ data: { bookingId } }), onSuccess: r => setMessage(r.message) });
  const bookings = useQuery({ queryKey: ["staff-bookings", user?.id, isAdmin], enabled: Boolean(user) && allowed, refetchInterval: 15000, queryFn: async () => {
    if (!user) throw new Error("Sign in required.");
    let query = supabase.from("bookings").select("*").order("preferred_date").order("time_window");
    if (!isAdmin) query = query.or(`cleaner_id.eq.${user.id},created_by_staff.eq.${user.id}`);
    const { data, error } = await query;
    if (error) throw error;
    return data as BookingRow[];
  } });
  const cleaners = useQuery({ queryKey: ["cleaners"], enabled: isAdmin, queryFn: async () => { const { data, error } = await supabase.rpc("list_cleaners"); if (error) throw error; return data; } });
  const rows = filterStaffBookings(bookings.data ?? [], filters);
  const cleanerList = isAdmin ? cleaners.data ?? [] : user ? [{ id: user.id, full_name: "My assigned visits", email: "" }] : [];
  const name = (id: string | null) => id ? cleanerList.find(c => c.id === id)?.full_name || "Assigned housekeeper" : "Unassigned";
  const control = "mt-2 w-full min-w-0 rounded-md border border-input bg-background p-3 text-base font-normal";
  function setFilter(key: keyof typeof filters, value: string) { navigate({ search: prev => ({ ...prev, [key]: value }), replace: true }); }
  return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Staff dashboard</h1><div className="flex gap-2"><Button asChild><Link to="/phone-booking"><Phone />New phone booking</Link></Button><Button variant="outline" size="icon" aria-label="Refresh staff dashboard" title="Refresh staff dashboard" onClick={() => bookings.refetch()}><RefreshCw /></Button></div></div>
    {loading ? <p className="mt-6">Loading…</p> : !allowed ? <p className="mt-6">Staff access required.</p> : <>
      <section className="mt-8 grid gap-5 border-y border-border py-6 sm:grid-cols-3">{[{ label: "Phone bookings", value: rows.filter(b => b.created_by_staff).length, icon: Phone }, { label: "Pending estimates", value: rows.filter(b => b.created_by_staff && b.status === "pending_payment").length, icon: Mail }, { label: "Scheduled visits", value: rows.filter(b => b.status === "confirmed").length, icon: CalendarDays }].map(s => <div key={s.label}><s.icon className="h-5 w-5 text-primary" /><p className="mt-2 text-sm text-muted-foreground">{s.label}</p><p className="mt-1 text-3xl font-bold">{s.value}</p></div>)}</section>
      <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0 text-sm font-semibold">From date<input type="date" value={filters.from} className={control} onChange={e => setFilter("from", e.target.value)} /></label>
        <label className="min-w-0 text-sm font-semibold">Through date<input type="date" value={filters.to} className={control} onChange={e => setFilter("to", e.target.value)} /></label>
        <label className="min-w-0 text-sm font-semibold">Cleaner<select value={filters.cleaner} className={control} onChange={e => setFilter("cleaner", e.target.value)}><option value="all">All visible cleaners</option><option value="unassigned">Unassigned</option>{cleanerList.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></label>
        <label className="min-w-0 text-sm font-semibold">Bookings<select value={filters.view} className={control} onChange={e => setFilter("view", e.target.value)}><option value="all">All bookings</option><option value="phone">Phone bookings</option><option value="estimates">Pending estimates</option><option value="scheduled">Scheduled visits</option></select></label>
      </div><Button variant="ghost" className="mt-3" onClick={() => navigate({ search: { from: "", to: "", cleaner: "all", view: "all" }, replace: true })}>Clear filters</Button>
      {message && <p role="status" className="mt-4 text-primary">{message}</p>}{(bookings.error || email.error || cleaners.error) && <p role="alert" className="mt-4 text-destructive">{(bookings.error || email.error || cleaners.error)?.message}</p>}
      <section className="mt-6"><h2 className="text-xl font-bold">Bookings & estimates</h2>{bookings.isPending ? <p className="mt-4">Loading bookings…</p> : rows.length === 0 ? <p className="mt-4 text-muted-foreground">No bookings match these filters.</p> : <div className="mt-4 divide-y divide-border">{rows.map(b => <article key={b.id} className="flex min-w-0 flex-wrap justify-between gap-4 py-5"><div className="min-w-0"><h3 className="break-words font-bold">{b.customer_name} · ${(b.amount_cents / 100).toFixed(2)}</h3><p className="mt-1 break-words text-sm">{b.service}</p><p className="mt-1 text-sm">{fmtDate(b.preferred_date)} · {b.time_window}</p><p className="mt-1 text-sm text-muted-foreground">{name(b.cleaner_id)}{b.created_by_staff ? " · Phone booking" : ""}</p><p className="mt-2 text-sm font-semibold text-primary">{b.status === "pending_payment" ? "Estimate · awaiting checkout" : b.status === "confirmed" ? "Scheduled · confirmed" : b.status === "completed" ? "Completed" : "Cancelled"}</p></div><div className="flex flex-wrap items-start gap-2">{b.status === "pending_payment" && b.created_by_staff && (isAdmin || b.created_by_staff === user?.id) && <Button variant="outline" disabled={email.isPending} onClick={() => email.mutate(b.id)}><Mail />Email estimate</Button>}{b.access_token && <Button asChild variant="outline"><Link to="/booking/$id" params={{ id: b.id }} search={{ t: b.access_token }}>View booking</Link></Button>}</div></article>)}</div>}</section>
      <section className="mt-10 border-t border-border pt-6"><h2 className="text-xl font-bold">Appointment calendar</h2><BookingScheduler admin={isAdmin} view="month" bookingFilters={filters} /></section>
    </>}
  </main></div>;
}