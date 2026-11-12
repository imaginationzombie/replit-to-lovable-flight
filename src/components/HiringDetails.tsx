import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Clock, DollarSign, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { hiringDetailsInput } from "@/lib/hiring-details";

export function HiringDetails({ applicationId, admin = false }: { applicationId: string; admin?: boolean }) {
  const details = useQuery({ queryKey: ["hiring-details", applicationId], queryFn: async () => {
    const { data, error } = await supabase.from("hiring_details").select("*").eq("application_id", applicationId).maybeSingle();
    if (error) throw error;
    return data;
  }, refetchInterval: 15000 });
  if (details.isPending) return <p className="mt-5 text-sm" role="status">Loading hiring details…</p>;
  if (details.error) return <div className="mt-5"><p role="alert" className="text-sm text-destructive">Couldn’t load hiring details.</p><Button variant="outline" onClick={() => details.refetch()}>Try again</Button></div>;
  const saved = details.data;
  return <section className="mt-6 border-t border-border pt-5" aria-label="Hiring details">
    <h3 className="text-lg font-bold">Your hiring details</h3>
    {saved ? <dl className="mt-4 grid gap-4 sm:grid-cols-3">
      <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />Start date</dt><dd className="mt-1 font-semibold">{new Date(saved.start_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</dd></div>
      <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" />Weekly hours</dt><dd className="mt-1 font-semibold">{saved.weekly_hours} hours / week</dd></div>
      <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" />Hourly pay</dt><dd className="mt-1 font-semibold">{(saved.hourly_pay_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} / hour</dd></div>
    </dl> : <p className="mt-3 text-sm text-muted-foreground">Approved · start date, hours and pay awaiting admin details.</p>}
    {admin && <HiringDetailsForm key={saved?.updated_at ?? "new"} applicationId={applicationId} initial={saved ? { startDate: saved.start_date, weeklyHours: String(saved.weekly_hours), hourlyPay: (saved.hourly_pay_cents / 100).toFixed(2) } : { startDate: "", weeklyHours: "", hourlyPay: "" }} />}
  </section>;
}

function HiringDetailsForm({ applicationId, initial }: { applicationId: string; initial: { startDate: string; weeklyHours: string; hourlyPay: string } }) {
  const [form, setForm] = useState(initial);
  const qc = useQueryClient();
  const save = useMutation({ mutationFn: async () => {
    const input = hiringDetailsInput(form);
    const { error } = await supabase.rpc("save_hiring_details", { _application_id: applicationId, ...input });
    if (error) throw error;
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ["hiring-details", applicationId] }) });
  return <form className="mt-5" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="min-w-0 text-sm font-semibold">Start date<input required type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="mt-1 block w-full min-w-0 rounded-md border border-input bg-background p-2 text-foreground" /></label>
      <label className="min-w-0 text-sm font-semibold">Weekly hours<input required type="number" min="0.01" max="168" step="0.01" value={form.weeklyHours} onChange={e => setForm({ ...form, weeklyHours: e.target.value })} className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-foreground" /></label>
      <label className="min-w-0 text-sm font-semibold">Hourly pay ($)<input required type="number" min="0.01" max="10000" step="0.01" value={form.hourlyPay} onChange={e => setForm({ ...form, hourlyPay: e.target.value })} className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-foreground" /></label>
    </div>
    {save.error && <p role="alert" className="mt-3 text-sm text-destructive">{save.error instanceof Error ? save.error.message : "Couldn’t save hiring details."}</p>}
    <Button className="mt-4" disabled={save.isPending}><Save />{save.isPending ? "Saving…" : "Save hiring details"}</Button>
  </form>;
}