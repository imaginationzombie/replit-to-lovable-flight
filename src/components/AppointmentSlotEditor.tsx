import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { slotLabel, validateSlot } from "@/lib/appointment-slots";
import { dateKey } from "@/lib/scheduling";
import { SlotDragCalendar } from "@/components/SlotDragCalendar";

export function AppointmentSlotEditor({ cleaner }: { cleaner: string }) {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [editing, setEditing] = useState<string>();
  const slots = useQuery({ queryKey: ["own-appointment-slots", cleaner], refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from("cleaner_appointment_slots").select("id,slot_date,start_time,end_time,active").eq("cleaner_id", cleaner).eq("active", true).gte("slot_date", dateKey(new Date())).order("slot_date").order("start_time");
    if (error) throw error;
    return data;
  } });
  const move = useMutation({ mutationFn: async ({ id, slot_date, start_time, end_time }: { id: string; slot_date: string; start_time: string; end_time: string }) => {
    const { error } = await supabase.rpc("save_appointment_slot", { _id: id, _date: slot_date, _start: start_time, _end: end_time, _active: true });
    if (error) throw error;
  }, onSuccess: async () => { await Promise.all(["own-appointment-slots", "public-appointment-slots"].map(key => qc.invalidateQueries({ queryKey: [key] }))); } });
  const save = useMutation({ mutationFn: async (remove?: { id: string; slot_date: string; start_time: string; end_time: string }) => {
    if (!remove) validateSlot(start, end);
    const { error } = await supabase.rpc("save_appointment_slot", { _date: remove?.slot_date ?? date, _start: remove?.start_time ?? start, _end: remove?.end_time ?? end, _id: remove?.id ?? editing, _active: !remove });
    if (error) throw error;
  }, onSuccess: async () => {
    setEditing(undefined);
    setDate("");
    await Promise.all(["own-appointment-slots", "public-appointment-slots"].map(key => qc.invalidateQueries({ queryKey: [key] })));
  } });
  const field = "mt-1 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-foreground";
  return <section className="mt-8 border-b border-border pb-8" aria-labelledby="slots-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="slots-heading" className="text-xl font-bold">Individual appointment slots</h2><Button asChild variant="outline"><Link to="/housekeepers/$id" params={{ id: cleaner }}>My public page</Link></Button></div>
    <p className="mt-2 text-sm text-muted-foreground">Appointment times · Eastern</p>
    <form className="mt-5 grid min-w-0 gap-4 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); save.mutate(undefined); }}>
      <label className="min-w-0 text-sm font-semibold">Slot date<input aria-label="Slot date" required type="date" min={dateKey(new Date())} value={date} onChange={e => setDate(e.target.value)} className={field}/></label>
      <label className="min-w-0 text-sm font-semibold">Start time<input aria-label="Slot start time" required type="time" value={start} onChange={e => setStart(e.target.value)} className={field}/></label>
      <label className="min-w-0 text-sm font-semibold">End time<input aria-label="Slot end time" required type="time" value={end} onChange={e => setEnd(e.target.value)} className={field}/></label>
      <div className="flex flex-wrap gap-2 sm:col-span-3"><Button disabled={save.isPending || !date} type="submit">{editing ? <Save/> : <Plus/>}{save.isPending ? "Saving…" : editing ? "Save slot" : "Create appointment slot"}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(undefined); setDate(""); save.reset(); }}>Cancel edit</Button>}</div>
    </form>
    {save.error && <p role="alert" className="mt-3 text-sm text-destructive">{save.error.message}</p>}
    {save.isSuccess && <p role="status" className="mt-3 text-sm text-primary">Appointment slots updated.</p>}
    {move.error && <p role="alert" className="mt-3 text-sm text-destructive">{move.error.message}</p>}
    {move.isSuccess && <p role="status" className="mt-3 text-sm text-primary">Appointment slot moved.</p>}
    <SlotDragCalendar slots={slots.data ?? []} disabled={save.isPending || move.isPending} move={(slot, slot_date) => move.mutate({ ...slot, slot_date })}/>
    {slots.isPending ? <p role="status" className="mt-5 text-muted-foreground">Loading appointment slots…</p> : slots.error ? <div className="mt-5"><p role="alert" className="text-destructive">Couldn’t load appointment slots.</p><Button variant="outline" onClick={() => slots.refetch()}>Try again</Button></div> : <ul className="mt-5 divide-y divide-border">{slots.data.map(s => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-semibold">{new Date(`${s.slot_date}T12:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p><p className="text-sm text-muted-foreground">{slotLabel(s)}</p></div><div className="flex shrink-0 gap-2"><Button type="button" size="icon" variant="outline" aria-label={`Edit ${s.slot_date} ${s.start_time}`} title="Edit slot" disabled={save.isPending} onClick={() => { setEditing(s.id); setDate(s.slot_date); setStart(s.start_time.slice(0,5)); setEnd(s.end_time.slice(0,5)); save.reset(); }}><Pencil/></Button><Button type="button" size="icon" variant="outline" aria-label={`Remove ${s.slot_date} ${s.start_time}`} title="Remove slot" disabled={save.isPending} onClick={() => save.mutate(s)}><X/></Button></div></li>)}</ul>}
    {slots.data?.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No upcoming appointment slots.</p>}
  </section>;
}