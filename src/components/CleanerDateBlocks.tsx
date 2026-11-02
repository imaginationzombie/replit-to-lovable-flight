import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { dateKey } from "@/lib/scheduling";
import { refreshBookingViews } from "@/lib/booking-sync";

export function CleanerDateBlocks() {
  const qc = useQueryClient();
  const [cleaner, setCleaner] = useState("");
  const [date, setDate] = useState("");
  const cleaners = useQuery({ queryKey: ["cleaners"], queryFn: async () => {
    const { data, error } = await supabase.rpc("list_cleaners");
    if (error) throw error;
    return data;
  }});
  const blocks = useQuery({ queryKey: ["cleaner-date-blocks"], refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from("cleaner_date_blocks").select("cleaner_id,blocked_date").gte("blocked_date", dateKey(new Date())).order("blocked_date");
    if (error) throw error;
    return data;
  }});
  const update = useMutation({ mutationFn: async (v: { cleaner: string; date: string; blocked: boolean }) => {
    const { error } = await supabase.rpc("set_cleaner_date_block", { _cleaner_id: v.cleaner, _date: v.date, _blocked: v.blocked });
    if (error) throw error;
  }, onSuccess: async () => {
    setDate("");
    await qc.invalidateQueries({ queryKey: ["cleaner-date-blocks"] });
    await refreshBookingViews(qc);
  }});
  const field = "rounded-md border border-input bg-background p-2 text-sm text-foreground";
  return <div className="mb-5 border-b border-border pb-5">
    <h3 className="mb-3 font-bold text-foreground">Cleaner date blocks</h3>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); update.mutate({ cleaner, date, blocked: true }); }}>
      <label className="grid gap-1 text-sm font-semibold">Cleaner<select required aria-label="Cleaner to block" className={field} value={cleaner} onChange={e => setCleaner(e.target.value)}><option value="">Select cleaner</option>{cleaners.data?.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Date<input required aria-label="Date to block" className={field} type="date" min={dateKey(new Date())} value={date} onChange={e => setDate(e.target.value)} /></label>
      <Button disabled={update.isPending}><CalendarOff />Block date</Button>
    </form>
    {(update.error || blocks.error || cleaners.error) && <p role="alert" className="mt-3 text-sm text-destructive">{(update.error || blocks.error || cleaners.error)?.message}</p>}
    {update.isSuccess && <p role="status" className="mt-3 text-sm text-primary">Date blocks updated.</p>}
    <ul className="mt-3 space-y-2">{blocks.data?.map(b => <li key={`${b.cleaner_id}:${b.blocked_date}`} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{cleaners.data?.find(c => c.id === b.cleaner_id)?.full_name || "Cleaner"} · {b.blocked_date}</span>
      <Button size="icon" variant="ghost" title="Unblock date" aria-label={`Unblock ${b.blocked_date}`} disabled={update.isPending} onClick={() => update.mutate({ cleaner: b.cleaner_id, date: b.blocked_date, blocked: false })}><X /></Button>
    </li>)}</ul>
  </div>;
}