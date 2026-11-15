import { useState } from "react";
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, KeyboardSensor, useSensors, useSensor, type DragEndEvent } from "@dnd-kit/core";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateKey, weekDates } from "@/lib/scheduling";
import { slotLabel, type AppointmentSlot } from "@/lib/appointment-slots";
function Slot({ slot, disabled }: { slot: AppointmentSlot; disabled: boolean }) {
  const drag = useDraggable({ id: slot.id, disabled });
  return <div ref={drag.setNodeRef} className={`flex min-w-0 items-start gap-1 rounded-md border border-border bg-card p-2 text-xs ${drag.isDragging ? "opacity-40" : ""}`}><Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 touch-none" title="Move appointment slot" aria-label={`Move ${slot.slot_date} ${slot.start_time}`} {...drag.listeners} {...drag.attributes}><GripVertical className="h-4 w-4"/></Button><span className="break-words">{slotLabel(slot)}</span></div>;
}
function Day({ date, slots, disabled }: { date: Date; slots: AppointmentSlot[]; disabled: boolean }) {
  const key = dateKey(date);
  const drop = useDroppable({ id: key, disabled: key < dateKey(new Date()) });
  return <div ref={drop.setNodeRef} className={`min-h-32 min-w-0 border border-border p-2 ${drop.isOver ? "bg-accent" : "bg-background"}`}><h3 className="mb-3 text-sm font-semibold">{format(date, "EEE MMM d")}</h3><div className="space-y-2">{slots.filter(s => s.slot_date === key).map(s => <Slot key={s.id} slot={s} disabled={disabled}/>)}</div></div>;
}
export function SlotDragCalendar({ slots, disabled, move }: { slots: AppointmentSlot[]; disabled: boolean; move: (slot: AppointmentSlot, date: string) => void }) {
  const [week, setWeek] = useState(() => new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = slots.find(slot => slot.id === activeId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  function end(e: DragEndEvent) { setActiveId(null); const slot = slots.find(s => s.id === e.active.id); if (!disabled && slot && e.over && slot.slot_date !== e.over.id) move(slot, String(e.over.id)); }
  return <div className="mt-6"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">{format(weekDates(week)[0] ?? week, "MMM d")} – {format(weekDates(week)[6] ?? week, "MMM d, yyyy")}</h3><div className="flex gap-2"><Button type="button" size="icon" variant="outline" aria-label="Previous slot week" onClick={() => setWeek(addDays(week,-7))}><ChevronLeft/></Button><Button type="button" size="icon" variant="outline" aria-label="Next slot week" onClick={() => setWeek(addDays(week,7))}><ChevronRight/></Button></div></div><DndContext sensors={sensors} onDragStart={e => setActiveId(String(e.active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={end}><div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{weekDates(week).map(d => <Day key={dateKey(d)} date={d} slots={slots} disabled={disabled}/>)}</div><DragOverlay>{active && <div className="w-44 rounded-md border border-primary bg-card p-3 text-sm text-foreground shadow-lg">{slotLabel(active)}</div>}</DragOverlay></DndContext></div>;
}