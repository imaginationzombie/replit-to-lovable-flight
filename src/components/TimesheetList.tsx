import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canReviewTimesheet } from "@/lib/cleaner-work";
import { Check, RotateCcw, Banknote } from "lucide-react";

export function TimesheetList({ admin = false, userId }: { admin?: boolean; userId?: string }) {
  const qc = useQueryClient();
  const [references, setReferences] = useState<Record<string, string>>({});
  const sheets = useQuery({ queryKey: ["timesheets", admin, userId], enabled: admin || !!userId, refetchInterval: 15000, queryFn: async () => {
    let query = supabase.from("appointment_work").select("*, bookings(service,preferred_date,time_window)").order("updated_at", { ascending: false });
    if (!admin && userId) query = query.eq("cleaner_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  } });
  const cleaners = useQuery({ queryKey: ["cleaners"], enabled: admin, queryFn: async () => {
    const { data, error } = await supabase.rpc("list_cleaners"); if (error) throw error; return data;
  } });
  const review = useMutation({ mutationFn: async ({ id, action }: { id: string; action: string }) => {
    const { error } = await supabase.rpc("review_timesheet", { _id: id, _action: action, _reference: references[id] ?? "" });
    if (error) throw error;
  }, onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["timesheets"], refetchType: "all" }), qc.invalidateQueries({ queryKey: ["appointment-work"], refetchType: "all" })]); } });
  const rows = sheets.data ?? [];
  const total = (status: string) => rows.filter(r => r.status === status).reduce((sum, r) => sum + r.amount_cents, 0);
  return <section className="mt-6">
    <div className="grid grid-cols-1 gap-4 border-y border-border py-5 sm:grid-cols-3">{[["Awaiting approval", total("submitted")], ["Approved · unpaid", total("approved")], ["Payments recorded", total("paid")]].map(([label, value]) => <div key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">${(Number(value) / 100).toFixed(2)}</p></div>)}</div>
    {sheets.isLoading && <p role="status" className="mt-6">Loading timesheets…</p>}
    {(sheets.error || review.error) && <p role="alert" className="mt-4 text-destructive">{(sheets.error ?? review.error)?.message}</p>}
    {sheets.isSuccess && rows.length === 0 && <p className="mt-6 text-muted-foreground">No timesheets yet.</p>}
    <div className="mt-5 space-y-4">{rows.map(row => <article key={row.id} className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{row.bookings?.service ?? "Appointment"}</h3><span className="text-sm font-semibold capitalize text-primary">{row.status}</span></div>
      <p className="mt-1 text-sm text-muted-foreground">{row.bookings?.preferred_date} · {row.bookings?.time_window}{admin ? ` · ${cleaners.data?.find(c => c.id === row.cleaner_id)?.full_name || "Cleaner"}` : ""}</p>
      <p className="mt-3 font-semibold">{Math.floor(row.minutes / 60)}h {row.minutes % 60}m · ${(row.rate_cents / 100).toFixed(2)}/hr · ${(row.amount_cents / 100).toFixed(2)}</p>
      {row.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{row.notes}</p>}
      {row.paid_at && <p className="mt-2 text-sm text-primary">Payment recorded {new Date(row.paid_at).toLocaleDateString()} · {row.payment_reference}</p>}
      {admin && row.status === "submitted" && <div className="mt-4 flex flex-wrap gap-2"><Button disabled={review.isPending} onClick={() => review.mutate({ id: row.id, action: "approve" })}><Check />Approve</Button><Button variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: row.id, action: "return" })}><RotateCcw />Return for edits</Button></div>}
      {admin && row.status === "approved" && <div className="mt-4 flex flex-wrap gap-2"><Input aria-label="Payment reference" placeholder="Payment reference" maxLength={200} className="max-w-xs" value={references[row.id] ?? ""} onChange={e => setReferences(old => ({ ...old, [row.id]: e.target.value }))} /><Button disabled={review.isPending || !canReviewTimesheet(row.status, "paid", references[row.id])} onClick={() => review.mutate({ id: row.id, action: "paid" })}><Banknote />Record payment</Button></div>}
    </article>)}</div>
  </section>;
}