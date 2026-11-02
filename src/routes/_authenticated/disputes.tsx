import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DisputePanel } from "@/components/DisputePanel";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { customerBookingsOptions } from "@/lib/customer-bookings";
import { disputeSchema } from "@/lib/customer-feedback";

export const Route = createFileRoute("/_authenticated/disputes")({ head: () => ({ meta: [
  { title: "Booking Disputes | HousekeepingBooking.com" }, { name: "description", content: "Report unpaid or uncleaned visits and track your admin resolution status." }, { property: "og:title", content: "Booking Disputes | HousekeepingBooking.com" }, { property: "og:description", content: "Track your booking reports and admin responses." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
] }), component: Disputes });
function Disputes() {
  const qc = useQueryClient();
  const bookings = useQuery(customerBookingsOptions);
  const [bookingId, setBookingId] = useState("");
  const [kind, setKind] = useState("uncleaned");
  const [details, setDetails] = useState("");
  const report = useMutation({ mutationFn: async () => {
    const v = disputeSchema.parse({ bookingId, kind, details });
    const { error } = await supabase.rpc("submit_booking_dispute", { _booking: v.bookingId, _kind: v.kind, _details: v.details });
    if (error) throw error;
  }, onSuccess: () => { setDetails(""); qc.invalidateQueries({ queryKey: ["booking-disputes"] }); } });
  const field = "mt-1 w-full rounded-md border border-input bg-background p-3 text-sm";
  return <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-3xl px-6 py-10"><h1 className="text-3xl font-extrabold">Booking disputes</h1>
    <form className="mt-6 space-y-4 border-b border-border pb-6" onSubmit={e => { e.preventDefault(); report.mutate(); }}>
      <label className="block text-sm font-semibold">Booking<select required className={field} value={bookingId} onChange={e => { setBookingId(e.target.value); report.reset(); }}><option value="">Select your booking</option>{bookings.data?.map(b => <option key={b.id} value={b.id}>{b.service} · {b.preferred_date} · {b.time_window}</option>)}</select></label>
      {bookings.error && <p role="alert" className="text-destructive">Couldn’t load your bookings.</p>}
      <label className="block text-sm font-semibold">Issue<select className={field} value={kind} onChange={e => setKind(e.target.value)}><option value="unpaid">Unpaid / payment issue</option><option value="uncleaned">Uncleaned / cleaning issue</option></select></label>
      <label className="block text-sm font-semibold">What happened?<textarea required minLength={10} maxLength={2000} rows={4} className={field} value={details} onChange={e => setDetails(e.target.value)} /></label>
      {report.error && <p role="alert" className="text-destructive">Couldn’t submit. Check your details; this booking may already have a report for this issue.</p>}
      {report.isSuccess && <p role="status" className="text-primary">Report submitted for admin review.</p>}
      <Button type="submit" disabled={report.isPending || !bookings.data?.length}>{report.isPending ? "Submitting…" : "Submit report"}</Button>
    </form><DisputePanel /></main></div>;
}