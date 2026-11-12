import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { appointmentTasks, earningsCents } from "@/lib/cleaner-work";
import type { BookingRow } from "@/components/BookingCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { roomCare } from "@/lib/room-care";
import { Save, Send } from "lucide-react";

export function AppointmentWork({ booking, userId, rate }: { booking: BookingRow; userId: string; rate: number }) {
  const qc = useQueryClient();
  const record = useQuery({ queryKey: ["appointment-work", booking.id, userId], queryFn: async () => {
    const { data, error } = await supabase.from("appointment_work").select("*").eq("booking_id", booking.id).eq("cleaner_id", userId).maybeSingle();
    if (error) throw error;
    return data;
  } });
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!record.data) return;
    setHours(String(Math.floor(record.data.minutes / 60))); setMinutes(String(record.data.minutes % 60));
    setNotes(record.data.notes); setTasks(record.data.completed_tasks);
  }, [record.data]);
  const locked = !!record.data && record.data.status !== "draft";
  const total = Number(hours) * 60 + Number(minutes);
  const valid = Number.isInteger(total) && total >= 0 && total <= 1440 && Number.isInteger(Number(minutes)) && Number(minutes) >= 0 && Number(minutes) < 60 && Number.isInteger(Number(hours)) && Number(hours) >= 0;
  const save = useMutation({ mutationFn: async (submit: boolean) => {
    if (!valid) throw new Error("Enter valid hours and minutes.");
    const { error } = await supabase.rpc("save_appointment_work", { _booking_id: booking.id, _minutes: total, _notes: notes, _tasks: tasks, _submit: submit });
    if (error) throw error;
    setMessage(submit ? "Timesheet submitted." : "Appointment progress saved.");
  }, onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["appointment-work"] }), qc.invalidateQueries({ queryKey: ["timesheets"], refetchType: "all" })]); } });
  const allTasks = appointmentTasks(booking);
  return <section className="mt-3 border-t border-border pt-4">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">Appointment to-do list</h3><span className="text-sm text-muted-foreground">{allTasks.filter(t => tasks.includes(t)).length}/{allTasks.length} complete · {record.data?.status ?? "draft"}</span></div>
    {record.isLoading ? <p role="status">Loading progress…</p> : <>
      <div className="mt-4 space-y-6">{roomCare(booking.bedrooms, booking.bathrooms).map(room => <div key={room.room}><h4 className="font-bold">{room.room}</h4><p className="mt-1 text-xs text-muted-foreground">Recommended products: {room.product}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{room.tasks.map(task => { const key = `${room.room}: ${task}`; return <label key={key} className="flex items-start gap-2 text-sm"><Checkbox aria-label={key} disabled={locked || record.isError} checked={tasks.includes(key)} onCheckedChange={checked => setTasks(old => checked ? [...old, key] : old.filter(t => t !== key))} />{task}</label>; })}</div></div>)}</div>
      <p className="mt-4 text-xs text-muted-foreground">Follow product labels and surface care instructions. Never mix chemicals.</p>
      <h4 className="mt-6 font-bold">Booked extras & final checks</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{allTasks.map(task => <label key={task} className="flex items-start gap-2 text-sm"><Checkbox aria-label={task} disabled={locked || record.isError} checked={tasks.includes(task)} onCheckedChange={checked => setTasks(previous => checked ? [...previous, task] : previous.filter(t => t !== task))} />{task}</label>)}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[100px_100px_1fr]">
        <label className="text-sm font-semibold">Hours<Input aria-label="Hours worked" type="number" min={0} max={24} disabled={locked} value={hours} onChange={e => setHours(e.target.value)} /></label>
        <label className="text-sm font-semibold">Minutes<Input aria-label="Minutes worked" type="number" min={0} max={59} disabled={locked} value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
        <div className="self-end text-sm text-muted-foreground">{locked ? `Submitted earnings: $${((record.data?.amount_cents ?? 0) / 100).toFixed(2)}` : `Estimated earnings: $${((valid ? earningsCents(total, rate) : 0) / 100).toFixed(2)} · $${(rate / 100).toFixed(2)}/hr`}</div>
      </div>
      <label className="mt-4 block text-sm font-semibold">Work notes<Textarea aria-label="Work notes" className="mt-1" maxLength={2000} disabled={locked} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      {!locked && <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={save.isPending || record.isError} onClick={() => save.mutate(false)}><Save />Save progress</Button><Button disabled={save.isPending || record.isError || !valid || total === 0} onClick={() => save.mutate(true)}><Send />Submit timesheet</Button></div>}
    </>}
    {(save.error || record.error) && <p role="alert" className="mt-2 text-sm text-destructive">{(save.error ?? record.error)?.message}</p>}
    {message && <p role="status" className="mt-2 text-sm text-primary">{message}</p>}
  </section>;
}