import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, GripVertical, CalendarClock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TIME_WINDOWS } from "@/lib/pricing";
import { canMoveJob, dateKey, weekDates } from "@/lib/scheduling";
import type { BookingRow } from "@/components/BookingCard";

type Target = { date: string; cleanerId: string | null };
type Move = Target & { booking: BookingRow; time: string };

function Job({ booking, movable, open }: { booking: BookingRow; movable: boolean; open: () => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: booking.id, disabled: !movable });
  return <article ref={setNodeRef} className={`rounded-md border border-border bg-accent p-2 text-accent-foreground ${isDragging ? "opacity-30" : ""}`}>
    <div className="flex items-start gap-1">
      {movable && <Button variant="ghost" size="icon" className="h-7 w-6 shrink-0 touch-none cursor-grab" aria-label={`Move ${booking.customer_name}`} title="Move booking" {...listeners} {...attributes}><GripVertical /></Button>}
      <div className="min-w-0 flex-1"><p className="break-words text-xs font-bold">{booking.customer_name}</p><p className="mt-1 text-xs">{booking.time_window.split(" (")[0]}</p><p className="mt-1 break-words text-xs text-muted-foreground">{booking.service}</p></div>
      {movable && <Button variant="ghost" size="icon" className="h-7 w-6 shrink-0" onClick={open} aria-label={`Reschedule ${booking.customer_name}`} title="Reschedule"><CalendarClock /></Button>}
    </div>
  </article>;
}

function Cell({ target, children }: { target: Target; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${target.date}:${target.cleanerId ?? "unassigned"}`, data: target });
  return <div ref={setNodeRef} aria-label={`${target.date} ${target.cleanerId ?? "unassigned"}`} className={`min-h-32 space-y-2 border-b border-r border-border p-2 ${isOver ? "bg-secondary/20 ring-2 ring-inset ring-primary" : "bg-card"}`}>{children}</div>;
}

export function BookingScheduler({ admin = false }: { admin?: boolean }) {
  const { user, isAdmin, isCleaner } = useAuth();
  const canAdmin = admin && isAdmin;
  const qc = useQueryClient();
  const [week, setWeek] = useState(new Date());
  const [filter, setFilter] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [move, setMove] = useState<Move | null>(null);
  const [message, setMessage] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const bookings = useQuery({ queryKey: ["scheduler-bookings", canAdmin, user?.id], enabled: !!user && (canAdmin || isCleaner), refetchInterval: 15000,
    queryFn: async () => {
      let query = supabase.from("bookings").select("*").eq("status", "confirmed").order("preferred_date");
      if (!canAdmin) query = query.eq("cleaner_id", user?.id ?? "");
      const { data, error } = await query;
      if (error) throw error;
      return data as BookingRow[];
    },
  });
  const cleaners = useQuery({ queryKey: ["cleaners"], enabled: canAdmin, refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.rpc("list_cleaners"); if (error) throw error; return data;
  }});
  const update = useMutation({ mutationFn: async (v: Move) => {
    const { error } = await supabase.rpc("schedule_booking", {
      _booking_id: v.booking.id, _date: v.date, _time_window: v.time, _cleaner_id: v.cleanerId,
      _expected_date: v.booking.preferred_date, _expected_time_window: v.booking.time_window, _expected_cleaner_id: v.booking.cleaner_id,
    });
    if (error) throw error;
  }, onSuccess: async () => {
    setMessage("Booking rescheduled."); setMove(null);
    await Promise.all(["scheduler-bookings", "admin-bookings", "cleaner-jobs", "my-bookings"].map(key => qc.invalidateQueries({ queryKey: [key] })));
  }});
  const days = weekDates(week);
  const allGroups = canAdmin ? [{ id: null, label: "Unassigned" }, ...(cleaners.data ?? []).map(c => ({ id: c.id as string | null, label: c.full_name || c.email }))] : [{ id: user?.id ?? null, label: "My schedule" }];
  const groups = allGroups.filter(g => filter === "all" || (g.id ?? "unassigned") === filter);
  const rows = bookings.data ?? [];
  const active = rows.find(b => b.id === activeId);
  const beginMove = (booking: BookingRow, target: Target) => { update.reset(); setMessage(""); setMove({ booking, ...target, time: booking.time_window }); };
  function drop(event: DragEndEvent) {
    setActiveId(null);
    const booking = rows.find(b => b.id === event.active.id);
    const target = event.over?.data.current as Target | undefined;
    if (!booking || !target || !canMoveJob(canAdmin, user?.id, booking)) return;
    if (target.date === booking.preferred_date && target.cleanerId === booking.cleaner_id) return;
    beginMove(booking, target);
  }
  return <section className="mt-6 min-w-0">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Previous week" title="Previous week" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft /></Button><h2 className="text-sm font-bold text-foreground">{format(days[0] ?? week, "MMM d")} – {format(days[6] ?? week, "MMM d, yyyy")}</h2><Button variant="outline" size="icon" aria-label="Next week" title="Next week" onClick={() => setWeek(addDays(week, 7))}><ChevronRight /></Button><Button variant="ghost" onClick={() => setWeek(new Date())}>Today</Button></div>
      <div className="flex items-center gap-2">{canAdmin && <select aria-label="Filter employee" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-48 rounded-md border border-input bg-background p-2 text-sm text-foreground"><option value="all">All employees</option>{allGroups.map(g => <option key={g.id ?? "unassigned"} value={g.id ?? "unassigned"}>{g.label}</option>)}</select>}<Button variant="outline" size="icon" aria-label="Refresh schedule" title="Refresh schedule" onClick={() => qc.invalidateQueries({ queryKey: ["scheduler-bookings"] })}><RefreshCw /></Button></div>
    </div>
    {message && <p role="status" className="mb-3 text-sm text-primary">{message}</p>}
    {(bookings.error || cleaners.error) && <p role="alert" className="mb-3 text-sm text-destructive">Couldn’t load the schedule. Please refresh.</p>}
    {bookings.isLoading && <p className="mb-3 text-sm text-muted-foreground">Loading schedule…</p>}
    <DndContext sensors={sensors} onDragStart={e => setActiveId(String(e.active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={drop}>
      <div className="overflow-x-auto rounded-md border border-border"><div className="grid min-w-[1080px] grid-cols-[160px_repeat(7,minmax(125px,1fr))]">
        <div className="border-b border-r border-border bg-muted p-3 text-xs font-bold text-muted-foreground">Employee</div>{days.map(d => <div key={dateKey(d)} className={`border-b border-r border-border p-3 text-center text-sm font-bold ${dateKey(d) === dateKey(new Date()) ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground"}`}>{format(d, "EEE")}<br />{format(d, "MMM d")}</div>)}
        {groups.map(g => <Row key={g.id ?? "unassigned"} label={g.label}>{days.map(d => <Cell key={dateKey(d)} target={{ date: dateKey(d), cleanerId: g.id }}>{rows.filter(b => b.preferred_date === dateKey(d) && b.cleaner_id === g.id).map(b => <Job key={b.id} booking={b} movable={canMoveJob(canAdmin, user?.id, b)} open={() => beginMove(b, { date: b.preferred_date, cleanerId: b.cleaner_id })} />)}</Cell>)}</Row>)}
      </div></div>
      <DragOverlay>{active && <div className="w-44 rounded-md border border-primary bg-accent p-3 text-sm font-bold text-accent-foreground shadow-lg">{active.customer_name}<p className="text-xs font-normal">{active.service}</p></div>}</DragOverlay>
    </DndContext>
    {!bookings.isLoading && rows.filter(b => days.some(d => dateKey(d) === b.preferred_date)).length === 0 && <p className="mt-4 text-sm text-muted-foreground">No confirmed visits this week.</p>}
    <Dialog open={!!move} onOpenChange={open => { if (!open && !update.isPending) setMove(null); }}><DialogContent><DialogTitle>Reschedule visit</DialogTitle><DialogDescription>{move?.booking.customer_name} · {move?.booking.service}</DialogDescription>
      {move && <form className="space-y-4" onSubmit={e => { e.preventDefault(); update.mutate(move); }}>
        <label className="block text-sm font-semibold">Date<input required type="date" min={dateKey(new Date())} value={move.date} onChange={e => setMove({ ...move, date: e.target.value })} className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-foreground" /></label>
        <label className="block text-sm font-semibold">Time window<select value={move.time} onChange={e => setMove({ ...move, time: e.target.value })} className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-foreground">{TIME_WINDOWS.map(t => <option key={t}>{t}</option>)}</select></label>
        {canAdmin && <label className="block text-sm font-semibold">Employee<select value={move.cleanerId ?? ""} onChange={e => setMove({ ...move, cleanerId: e.target.value || null })} className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-foreground">{allGroups.map(g => <option key={g.id ?? "unassigned"} value={g.id ?? ""}>{g.label}</option>)}</select></label>}
        {update.error && <p role="alert" className="text-sm text-destructive">{update.error.message}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={update.isPending} onClick={() => setMove(null)}>Cancel</Button><Button disabled={update.isPending}>{update.isPending ? "Saving…" : "Save schedule"}</Button></div>
      </form>}
    </DialogContent></Dialog>
  </section>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <><div className="border-b border-r border-border bg-muted/50 p-3 text-sm font-semibold text-foreground break-words">{label}</div>{children}</>;
}