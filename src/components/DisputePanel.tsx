import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { disputesOptions, DISPUTE_STATUS, resolutionSchema } from "@/lib/customer-feedback";
import { Button } from "./ui/button";

export function DisputePanel({ admin = false }: { admin?: boolean }) {
  const disputes = useQuery(disputesOptions(admin));
  return <section className="mt-6"><h2 className="text-xl font-bold">{admin ? "Booking disputes" : "My reports"}</h2>
    {disputes.isPending && <p className="mt-4 text-muted-foreground">Loading reports…</p>}
    {disputes.error && <p role="alert" className="mt-4 text-destructive">Couldn’t load reports.</p>}
    {disputes.data?.length === 0 && <p className="mt-4 text-muted-foreground">No reports.</p>}
    <div className="mt-4 space-y-4">{disputes.data?.map(d => <article key={d.id} className="rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{d.bookings?.service ?? "Booking"} · {d.bookings?.preferred_date}</h3><p className="mt-1 text-sm text-muted-foreground">{d.bookings?.time_window}{admin && d.bookings?.customer_name ? ` · ${d.bookings.customer_name}` : ""}</p></div><span className="text-sm font-bold text-primary">{DISPUTE_STATUS[d.status as keyof typeof DISPUTE_STATUS]}</span></div>
      <p className="mt-3 font-semibold">{d.kind === "unpaid" ? "Unpaid / payment issue" : "Uncleaned / cleaning issue"}</p><p className="mt-1 whitespace-pre-wrap break-words">{d.details}</p>
      <p className="mt-3 text-xs text-muted-foreground">Reported {new Date(d.created_at).toLocaleDateString()} · Updated {new Date(d.updated_at).toLocaleDateString()}</p>
      {d.resolution && <div className="mt-4 border-t border-border pt-3"><h4 className="text-sm font-bold">Admin response</h4><p className="mt-1 whitespace-pre-wrap break-words">{d.resolution}</p></div>}
      {admin && <ResolutionForm id={d.id} initialStatus={d.status} initialResolution={d.resolution} />}
    </article>)}</div></section>;
}
function ResolutionForm({ id, initialStatus, initialResolution }: { id: string; initialStatus: string; initialResolution: string }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(initialStatus);
  const [resolution, setResolution] = useState(initialResolution);
  const save = useMutation({ mutationFn: async () => {
    const v = resolutionSchema.parse({ status, resolution });
    const { error } = await supabase.rpc("resolve_booking_dispute", { _id: id, _status: v.status, _resolution: v.resolution });
    if (error) throw error;
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ["booking-disputes"] }) });
  return <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
    <label className="block text-sm font-semibold">Resolution status<select className="ml-3 rounded-md border border-input bg-background p-2" value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(DISPUTE_STATUS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
    <label className="block text-sm font-semibold">Admin response<textarea className="mt-1 w-full rounded-md border border-input bg-background p-2" rows={3} maxLength={2000} value={resolution} onChange={e => setResolution(e.target.value)} /></label>
    {save.error && <p role="alert" className="text-destructive">Couldn’t save. Final decisions require a resolution note.</p>}
    {save.isSuccess && <p className="text-sm text-primary">Resolution saved.</p>}
    <Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save resolution"}</Button>
  </form>;
}