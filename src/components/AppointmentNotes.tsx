import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BookingRow } from "@/components/BookingCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Save } from "lucide-react";
import { ADD_ONS, addOnPrice, quote } from "@/lib/pricing";
export function AppointmentNotes({ booking }: { booking: BookingRow }) {
 const qc = useQueryClient(); const [body, setBody] = useState(""); const [editing, setEditing] = useState(false); const [extras, setExtras] = useState<string[]>([]);
 const notes = useQuery({ queryKey: ["appointment-notes", booking.id], queryFn: async () => { const { data, error } = await supabase.from("appointment_notes").select("*").eq("booking_id", booking.id).order("created_at", { ascending: false }); if (error) throw error; return data; } });
 const total = quote({ service: booking.service, bedrooms: booking.bedrooms, bathrooms: booking.bathrooms, addOns: [...booking.add_ons, ...extras], rush: booking.rush });
 const save = useMutation({ mutationFn: async () => { const { error } = await supabase.rpc("add_appointment_note", { _booking: booking.id, _body: body, _add_ons: extras }); if (error) throw error; }, onSuccess: async () => { setBody(""); setExtras([]); setEditing(false); await qc.invalidateQueries({ queryKey: ["appointment-notes", booking.id] }); } });
 return <>
 <section className="border-t border-border py-6"><h2 className="text-xl font-bold">Add-on options</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(ADD_ONS).map(([name, price]) => <label key={name} className="flex items-start gap-3 text-sm"><Checkbox aria-label={`Request ${name}`} disabled={booking.add_ons.includes(name)} checked={booking.add_ons.includes(name) || extras.includes(name)} onCheckedChange={checked => { setEditing(true); setExtras(old => checked ? [...old, name] : old.filter(x => x !== name)); }} /><span>{name}<span className="mt-1 block text-muted-foreground">${price.toFixed(2)} list · {total.freeAddOns.includes(name) ? "$0.00 included" : `$${addOnPrice(name).toFixed(2)} after 50% off`}{booking.add_ons.includes(name) ? " · Booked" : ""}</span></span></label>)}</div><p className="mt-4 text-sm text-muted-foreground">{total.includedHours} add-ons included. Additional selections are requests saved with your note; customer approval is required before changing their price.</p></section>
 <section className="border-t border-border py-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Appointment notes</h2><Button variant="outline" onClick={() => setEditing(true)}><Plus />Add new note</Button></div>
 {booking.notes && <div className="mt-4"><h3 className="text-sm font-semibold">Customer notes</h3><p className="mt-1 whitespace-pre-wrap text-sm">{booking.notes}</p></div>}
 {editing && <form className="mt-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}><label className="text-sm font-semibold">New note<Textarea className="mt-2" required maxLength={2000} value={body} onChange={e => setBody(e.target.value)} /></label><Button className="mt-3" disabled={!body.trim() || save.isPending}><Save />Save note{extras.length ? " & add-on request" : ""}</Button></form>}
 <h3 className="mt-6 text-sm font-semibold">Previous notes</h3>{notes.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No previous notes.</p>}{notes.data?.map(note => <article key={note.id} className="mt-3 border-b border-border pb-4"><p className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>{note.requested_add_ons.length > 0 && <p className="mt-2 text-sm text-primary">Requested: {note.requested_add_ons.join(", ")}</p>}</article>)}
 {(notes.error || save.error) && <p role="alert" className="mt-3 text-destructive">{(notes.error || save.error)?.message}</p>}
 </section></>;
}
