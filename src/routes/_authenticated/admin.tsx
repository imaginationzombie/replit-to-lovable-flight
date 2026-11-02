import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { BookingCard, STATUS_LABEL, type BookingRow } from "@/components/BookingCard";
import { useAuth, type Role } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin | HousekeeperBooking.com" },
      { name: "description", content: "Manage bookings, cleaners and accounts." },
      { property: "og:title", content: "Admin | HousekeeperBooking.com" },
      { property: "og:description", content: "Manage bookings, cleaners and accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<"bookings" | "calendar" | "schedules" | "people">("calendar");
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-extrabold text-foreground">Admin</h1>
        {!loading && !isAdmin && <p className="mt-6 rounded-xl bg-muted p-6 text-muted-foreground">You don't have admin access.</p>}
        {isAdmin && (
          <>
            <div className="mt-6 flex gap-2">
              {(["calendar", "schedules", "bookings", "people"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>
            {tab === "bookings" ? <Bookings /> : tab === "calendar" ? <CalendarView /> : tab === "schedules" ? <Schedules /> : <People />}
          </>
        )}
      </main>
    </div>
  );
}

function Bookings() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const bookings = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").order("preferred_date", { ascending: false }).limit(500);
      if (error) throw error;
      return data as BookingRow[];
    },
  });
  const cleaners = useQuery({
    queryKey: ["cleaners"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_cleaners");
      if (error) throw error;
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async (v: { id: string; patch: { cleaner_id?: string | null; status?: string } }) => {
      const { error } = await supabase.from("bookings").update(v.patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-bookings"] }),
  });

  const rows = (bookings.data ?? []).filter((b) => filter === "all" || b.status === filter);
  const select = "rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground";
  return (
    <section className="mt-6">
      <select className={select} value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All statuses</option>
        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {bookings.isLoading && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {rows.length === 0 && !bookings.isLoading && <p className="mt-4 rounded-xl bg-muted p-6 text-muted-foreground">No bookings.</p>}
      <div className="mt-4 space-y-3">
        {rows.map((b) => (
          <BookingCard key={b.id} b={b} showCustomer>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Assign cleaner" className={select} value={b.cleaner_id ?? ""}
                onChange={(e) => update.mutate({ id: b.id, patch: { cleaner_id: e.target.value || null } })}>
                <option value="">Unassigned</option>
                {cleaners.data?.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
              </select>
              <select aria-label="Status" className={select} value={b.status}
                onChange={(e) => update.mutate({ id: b.id, patch: { status: e.target.value } })}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </BookingCard>
        ))}
      </div>
    </section>
  );
}

function People() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const people = useQuery({
    queryKey: ["admin-people"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, phone").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      return (p.data ?? []).map((x) => ({ ...x, roles: (r.data ?? []).filter((y) => y.user_id === x.id).map((y) => y.role as Role) }));
    },
  });
  const toggle = useMutation({
    mutationFn: async (v: { userId: string; role: Role; on: boolean }) => {
      const { error } = v.on
        ? await supabase.from("user_roles").insert({ user_id: v.userId, role: v.role })
        : await supabase.from("user_roles").delete().eq("user_id", v.userId).eq("role", v.role);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-people"] }); qc.invalidateQueries({ queryKey: ["cleaners"] }); },
  });

  return (
    <section className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Cleaner</th><th className="p-3">Admin</th></tr>
        </thead>
        <tbody>
          {people.data?.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="p-3 font-semibold text-foreground">{p.full_name || "—"}</td>
              <td className="p-3 text-muted-foreground">{p.email}</td>
              {(["cleaner", "admin"] as const).map((role) => (
                <td key={role} className="p-3">
                  <input type="checkbox" aria-label={`${role} for ${p.email}`} checked={p.roles.includes(role)}
                    disabled={toggle.isPending || (role === "admin" && p.id === user?.id)}
                    onChange={(e) => toggle.mutate({ userId: p.id, role, on: e.target.checked })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {toggle.error && <p className="p-3 text-sm text-destructive">Couldn't update that role.</p>}
    </section>
  );
}

const TAB_LABEL = { calendar: "Calendar", schedules: "Cleaner schedules", bookings: "All bookings", people: "People & roles" } as const;

function useAdminBookings() {
  return useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").order("preferred_date", { ascending: false }).limit(500);
      if (error) throw error;
      return data as BookingRow[];
    },
  });
}
function useCleaners() {
  return useQuery({
    queryKey: ["cleaners"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_cleaners");
      if (error) throw error;
      return data;
    },
  });
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalendarView() {
  const bookings = useAdminBookings();
  const cleaners = useCleaners();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [day, setDay] = useState(() => ymd(new Date()));
  const live = (bookings.data ?? []).filter((b) => b.status !== "cancelled" && b.status !== "pending_payment");
  const byDay = new Map<string, BookingRow[]>();
  live.forEach((b) => byDay.set(b.preferred_date, [...(byDay.get(b.preferred_date) ?? []), b]));
  const start = new Date(month); start.setDate(1 - month.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const name = (id: string | null) => cleaners.data?.find((c) => c.id === id)?.full_name || cleaners.data?.find((c) => c.id === id)?.email || "Unassigned";
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const today = ymd(new Date());
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="rounded-lg bg-muted px-3 py-1.5 text-sm font-bold text-foreground">‹ Prev</button>
        <h2 className="text-lg font-bold text-foreground">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
        <button onClick={() => shift(1)} className="rounded-lg bg-muted px-3 py-1.5 text-sm font-bold text-foreground">Next ›</button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const k = ymd(d); const list = byDay.get(k) ?? []; const inMonth = d.getMonth() === month.getMonth();
          return (
            <button key={k} onClick={() => setDay(k)}
              className={`min-h-20 rounded-lg border p-1.5 text-left text-xs ${day === k ? "border-primary ring-2 ring-primary" : "border-border"} ${inMonth ? "bg-card" : "bg-muted/50"}`}>
              <span className={`font-bold ${k === today ? "text-primary" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>{d.getDate()}</span>
              {list.slice(0, 2).map((b) => <div key={b.id} className="mt-1 truncate rounded bg-accent px-1 text-accent-foreground">{b.time_window.split(" ")[0]} {b.customer_name}</div>)}
              {list.length > 2 && <div className="mt-1 text-muted-foreground">+{list.length - 2} more</div>}
            </button>
          );
        })}
      </div>
      <h3 className="mt-6 font-bold text-foreground">{new Date(day + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
      <div className="mt-3 space-y-3">
        {(byDay.get(day) ?? []).length === 0 && <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No cleanings this day.</p>}
        {(byDay.get(day) ?? []).map((b) => (
          <BookingCard key={b.id} b={b} showCustomer><p className="text-sm text-muted-foreground">Cleaner: <b className="text-foreground">{name(b.cleaner_id)}</b></p></BookingCard>
        ))}
      </div>
    </section>
  );
}

function Schedules() {
  const bookings = useAdminBookings();
  const cleaners = useCleaners();
  const today = ymd(new Date());
  const upcoming = (bookings.data ?? []).filter((b) => b.preferred_date >= today && (b.status === "confirmed" || b.status === "completed"))
    .sort((a, b) => a.preferred_date.localeCompare(b.preferred_date));
  const groups = [...(cleaners.data ?? []).map((c) => ({ id: c.id as string | null, label: c.full_name || c.email })), { id: null, label: "Unassigned" }];
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2">
      {cleaners.data?.length === 0 && <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground md:col-span-2">No cleaners yet. Tick "Cleaner" for someone under People & roles.</p>}
      {groups.map((g) => {
        const jobs = upcoming.filter((b) => b.cleaner_id === g.id);
        return (
          <div key={g.id ?? "none"} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><h3 className="font-bold text-foreground">{g.label}</h3><span className="text-xs text-muted-foreground">{jobs.length} upcoming</span></div>
            <ul className="mt-3 space-y-2">
              {jobs.length === 0 && <li className="text-sm text-muted-foreground">Nothing scheduled.</li>}
              {jobs.map((b) => (
                <li key={b.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                  <b className="text-foreground">{new Date(b.preferred_date + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</b>
                  <span className="text-muted-foreground"> · {b.time_window} · {b.service} · {b.customer_name}, {b.service_area}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
