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
  const [tab, setTab] = useState<"bookings" | "people">("bookings");
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-extrabold text-foreground">Admin</h1>
        {!loading && !isAdmin && <p className="mt-6 rounded-xl bg-muted p-6 text-muted-foreground">You don't have admin access.</p>}
        {isAdmin && (
          <>
            <div className="mt-6 flex gap-2">
              {(["bookings", "people"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {t === "bookings" ? "Bookings" : "People & roles"}
                </button>
              ))}
            </div>
            {tab === "bookings" ? <Bookings /> : <People />}
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
