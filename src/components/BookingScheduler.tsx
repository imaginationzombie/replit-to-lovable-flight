import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, pointerWithin, rectIntersection, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { addDays, addMonths, format, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, GripVertical, CalendarClock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TIME_WINDOWS } from "@/lib/pricing";
import { canMoveJob, dateKey, weekDates } from "@/lib/scheduling";
import type { BookingRow } from "@/components/BookingCard";
import { refreshBookingViews } from "@/lib/booking-sync";

type Target = { date: string; cleanerId: string | null; preserveCleaner?: boolean };
type Move = Target & { booking: BookingRow; time: string };

function Job({ booking, movable, open, cleaner }: { booking: BookingRow; movable: boolean; open: () => void; cleaner?: string }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: booking.id, disabled: !movable });
  return <article ref={setNodeRef} className={`rounded-md border border-border bg-accent p-2 text-accent-foreground ${isDragging ? "opacity-30" : ""}`}>
    <p className="truncate text-xs font-bold" title={booking.customer_name}>{booking.customer_name}</p>
    {cleaner && <p className="mt-1 break-words text-xs font-semibold">{cleaner}</p>}
    <p className="mt-1 truncate text-xs text-muted-foreground" title={booking.service}>{booking.service}</p>
    <p className="mt-1 text-xs">{booking.time_window}</p>
    <div className="mt-1 flex items-center justify-between gap-1">
      {movable && <Button variant="ghost" size="icon" className="h-7 w-6 shrink-0 touch-none cursor-grab" aria-label={`Move ${booking.customer_name}`} title="Move booking" {...listeners} {...attributes}><GripVertical /></Button>}
      {movable && <Button variant="ghost" size="icon" className="h-7 w-6 shrink-0" onClick={open} aria-label={`Reschedule ${booking.customer_name}`} title="Reschedule"><CalendarClock /></Button>}
    </div>
  </article>;
}

function Cell({ target, children }: { target: Target; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${target.date}:${target.cleanerId ?? "unassigned"}`, data: target });
  return <div ref={setNodeRef} aria-label={`${target.date} ${target.cleanerId ?? "unassigned"}`} className={`min-h-32 space-y-2 border-b border-r border-border p-2 ${isOver ? "bg-secondary/20 ring-2 ring-inset ring-primary" : "bg-card"}`}>{children}</div>;
}

export function BookingScheduler({ admin = false, view = "week" }: { admin?: boolean; view?: "week" | "month" }) {
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
      let query = supabase.from("bookings").select("*").in("status", ["confirmed", "completed"]).order("preferred_date").order("time_window");
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
    const { error } = await supabase.rpc("reschedule_booking", {
      _booking_id: v.booking.id, _date: v.date, _time_window: v.time, _assignment: { cleaner_id: v.cleanerId },
      _expected: { date: v.booking.preferred_date, time_window: v.booking.time_window, cleaner_id: v.booking.cleaner_id },
    });
    if (error) throw error;
  }, onSuccess: async () => {
    setMessage("Booking rescheduled."); setMove(null);
    await refreshBookingViews(qc);
  }});
  const days = weekDates(week);
  const monthStart = startOfMonth(week);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i));
  const allGroups = canAdmin ? [{ id: null, label: "Unassigned" }, ...(cleaners.data ?? []).map(c => ({ id: c.id as string | null, label: c.full_name || c.email }))] : [{ id: user?.id ?? null, label: "My schedule" }];
  const groups = allGroups.filter(g => filter === "all" || (g.id ?? "unassigned") === filter);
  const rows = bookings.data ?? [];
  const visibleRows = rows.filter(b => filter === "all" || (b.cleaner_id ?? "unassigned") === filter);
  const cleanerName = (id: string | null) => allGroups.find(g => g.id === id)?.label ?? (id ? "Assigned housekeeper" : "Unassigned");
  const active = rows.find(b => b.id === activeId);
  const beginMove = (booking: BookingRow, target: Target) => { update.reset(); setMessage(""); setMove({ booking, ...target, time: booking.time_window }); };
  function drop(event: DragEndEvent) {
    setActiveId(null);
    const booking = rows.find(b => b.id === event.active.id);
    const target = event.over?.data.current as Target | undefined;
    if (!booking || !target || !canMoveJob(canAdmin, user?.id, booking)) return;
    const assignment = target.preserveCleaner ? booking.cleaner_id : target.cleanerId;
    if (target.date === booking.preferred_date && assignment === booking.cleaner_id) return;
    beginMove(booking, { ...target, cleanerId: assignment });
  }
  return <section className="mt-6 min-w-0">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="icon" aria-label={`Previous ${view}`} title={`Previous ${view}`} onClick={() => setWeek(view === "month" ? addMonths(week, -1) : addDays(week, -7))}><ChevronLeft /></Button><h2 className="text-sm font-bold text-foreground">{view === "month" ? format(week, "MMMM yyyy") : `${format(days[0] ?? week, "MMM d")} – ${format(days[6] ?? week, "MMM d, yyyy")}`}</h2><Button variant="outline" size="icon" aria-label={`Next ${view}`} title={`Next ${view}`} onClick={() => setWeek(view === "month" ? addMonths(week, 1) : addDays(week, 7))}><ChevronRight /></Button><Button variant="ghost" onClick={() => setWeek(new Date())}>Today</Button></div>
      <div className="flex items-center gap-2">{canAdmin && <select aria-label="Filter employee" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-48 rounded-md border border-input bg-background p-2 text-sm text-foreground"><option value="all">All employees</option>{allGroups.map(g => <option key={g.id ?? "unassigned"} value={g.id ?? "unassigned"}>{g.label}</option>)}</select>}<Button variant="outline" size="icon" aria-label="Refresh schedule" title="Refresh schedule" onClick={() => qc.invalidateQueries({ queryKey: ["scheduler-bookings"] })}><RefreshCw /></Button></div>
    </div>
    {message && <p role="status" className="mb-3 text-sm text-primary">{message}</p>}
    {(bookings.error || cleaners.error) && <p role="alert" className="mb-3 text-sm text-destructive">Couldn’t load the schedule. Please refresh.</p>}
    {bookings.isLoading && <p className="mb-3 text-sm text-muted-foreground">Loading schedule…</p>}
    <DndContext sensors={sensors} collisionDetection={args => args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)} onDragStart={e => setActiveId(String(e.active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={drop}>
      {view === "month" ? <div className="overflow-x-auto rounded-md border border-border"><div className="grid min-w-[980px] grid-cols-7">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <div key={day} className="border-b border-r border-border bg-muted p-3 text-center text-xs font-bold text-muted-foreground">{day}</div>)}
        {monthDays.map(day => <Cell key={dateKey(day)} target={{ date: dateKey(day), cleanerId: null, preserveCleaner: true }}>
          <p className={`text-sm font-bold ${dateKey(day) === dateKey(new Date()) ? "text-primary" : day.getMonth() === week.getMonth() ? "text-foreground" : "text-muted-foreground"}`}>{format(day, day.getMonth() === week.getMonth() ? "d" : "MMM d")}</p>
          {visibleRows.filter(b => b.preferred_date === dateKey(day)).map(b => <Job key={b.id} booking={b} cleaner={cleanerName(b.cleaner_id)} movable={canMoveJob(canAdmin, user?.id, b)} open={() => beginMove(b, { date: b.preferred_date, cleanerId: b.cleaner_id })} />)}
        </Cell>)}
      </div></div> : <div className="overflow-x-auto rounded-md border border-border"><div className="grid min-w-[1080px] grid-cols-[160px_repeat(7,minmax(125px,1fr))]">
        <div className="border-b border-r border-border bg-muted p-3 text-xs font-bold text-muted-foreground">Employee</div>{days.map(d => <div key={dateKey(d)} className={`border-b border-r border-border p-3 text-center text-sm font-bold ${dateKey(d) === dateKey(new Date()) ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground"}`}>{format(d, "EEE")}<br />{format(d, "MMM d")}</div>)}
        {groups.map(g => <Row key={g.id ?? "unassigned"} label={g.label}>{days.map(d => <Cell key={dateKey(d)} target={{ date: dateKey(d), cleanerId: g.id }}>{rows.filter(b => b.preferred_date === dateKey(d) && b.cleaner_id === g.id).map(b => <Job key={b.id} booking={b} movable={canMoveJob(canAdmin, user?.id, b)} open={() => beginMove(b, { date: b.preferred_date, cleanerId: b.cleaner_id })} />)}</Cell>)}</Row>)}
      </div></div>}
      <DragOverlay>{active && <div className="w-44 rounded-md border border-primary bg-accent p-3 text-sm font-bold text-accent-foreground shadow-lg">{active.customer_name}<p className="text-xs font-normal">{active.service}</p></div>}</DragOverlay>
    </DndContext>
    {!bookings.isLoading && visibleRows.filter(b => (view === "month" ? monthDays : days).some(d => dateKey(d) === b.preferred_date)).length === 0 && <p className="mt-4 text-sm text-muted-foreground">No booked visits this {view}.</p>}
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