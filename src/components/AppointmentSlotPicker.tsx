import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { publicAppointmentSlots } from "@/lib/appointment-slots.functions";
import { slotLabel, type AppointmentSlot } from "@/lib/appointment-slots";

export function AppointmentSlotPicker({ cleaner, value, onChange }: { cleaner: string; value?: string; onChange: (slot: AppointmentSlot | null) => void }) {
  const [date, setDate] = useState("");
  const slots = useQuery({ queryKey: ["public-appointment-slots", cleaner], queryFn: () => publicAppointmentSlots({ data: { cleaner } }), refetchInterval: 15000, staleTime: 0 });
  const dates = [...new Set((slots.data ?? []).map(s => s.slot_date))];
  const selectedDate = dates.includes(date) ? date : dates[0] ?? "";
  useEffect(() => { if (value && slots.data && !slots.data.some(s => s.id === value)) onChange(null); }, [value, slots.data, onChange]);
  return <section aria-labelledby="pick-slot-heading"><h2 id="pick-slot-heading" className="text-lg font-bold">Available appointments</h2><p className="mt-1 text-sm text-muted-foreground">Eastern time</p>
    {slots.isPending ? <p role="status" className="mt-3 text-muted-foreground">Loading appointment times…</p> : slots.error ? <div className="mt-3"><p role="alert" className="text-destructive">Couldn’t load appointment times.</p><Button variant="outline" onClick={() => slots.refetch()}>Try again</Button></div> : !dates.length ? <p className="mt-3 text-muted-foreground">No appointment slots currently available with this housekeeper.</p> : <>
      <label className="mt-3 block text-sm font-semibold">Appointment date<select aria-label="Appointment date" className="mt-1 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-foreground" value={selectedDate} onChange={e => { setDate(e.target.value); onChange(null); }}>{dates.map(d => <option key={d} value={d}>{new Date(`${d}T12:00`).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</option>)}</select></label>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{(slots.data ?? []).filter(s => s.slot_date === selectedDate).map(s => <Button type="button" key={s.id} variant={value === s.id ? "default" : "outline"} aria-pressed={value === s.id} className="h-auto min-h-11 whitespace-normal py-3" onClick={() => onChange(s)}>{slotLabel(s)}</Button>)}</div>
    </>}
  </section>;
}