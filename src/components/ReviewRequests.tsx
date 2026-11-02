import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canReviewBooking, ownReviewsOptions, reviewSchema } from "@/lib/customer-feedback";
import type { BookingRow } from "./BookingCard";
import { Button } from "./ui/button";

export function ReviewRequests({ bookings }: { bookings: BookingRow[] }) {
  const reviews = useQuery(ownReviewsOptions);
  const eligible = bookings.filter(canReviewBooking);
  if (!eligible.length) return null;
  return <section className="mt-8 border-t border-border pt-6"><h2 className="text-xl font-bold">How was your cleaning?</h2>
    {reviews.error && <p role="alert" className="text-destructive">Couldn’t load your reviews.</p>}
    {reviews.data && <div className="mt-4 space-y-4">{eligible.map(b => {
      const review = reviews.data.find(r => r.booking_id === b.id);
      return review ? <article key={b.id} className="rounded-md border border-border bg-card p-4"><h3 className="font-bold">{b.service} · {b.preferred_date}</h3><p className="mt-2 text-primary">{review.rating}/5 · Review submitted</p><p className="mt-2 whitespace-pre-wrap break-words">{review.body}</p></article> : <ReviewForm key={b.id} booking={b} />;
    })}</div>}
  </section>;
}
function ReviewForm({ booking }: { booking: BookingRow }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [publicName, setPublicName] = useState("Verified customer");
  const submit = useMutation({ mutationFn: async () => {
    const v = reviewSchema.parse({ bookingId: booking.id, rating, body, publicName });
    const { error } = await supabase.rpc("submit_cleaner_review", { _booking: v.bookingId, _rating: v.rating, _body: v.body, _name: v.publicName });
    if (error) throw error;
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-cleaning-reviews"] }); qc.invalidateQueries({ queryKey: ["public-housekeeper"] }); } });
  const field = "mt-1 w-full rounded-md border border-input bg-background p-2 text-sm";
  return <article className="rounded-md border border-border bg-card p-4"><h3 className="font-bold">{booking.service} · {booking.preferred_date}</h3>
    <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); submit.mutate(); }}>
      <fieldset><legend className="text-sm font-semibold">Your rating</legend><div className="mt-1 flex gap-1">{[1, 2, 3, 4, 5].map(n => <Button key={n} type="button" variant="ghost" size="icon" aria-label={`${n} stars`} aria-pressed={rating === n} onClick={() => setRating(n)}><Star className={n <= rating ? "fill-primary text-primary" : "text-muted-foreground"} /></Button>)}</div></fieldset>
      <label className="block text-sm font-semibold">Public display name<input required maxLength={60} className={field} value={publicName} onChange={e => setPublicName(e.target.value)} /></label>
      <label className="block text-sm font-semibold">Your review<textarea required minLength={10} maxLength={2000} rows={3} className={field} value={body} onChange={e => setBody(e.target.value)} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" />Publish my rating, review and display name on my housekeeper’s public page.</label>
      {submit.error && <p role="alert" className="text-sm text-destructive">Couldn’t submit your review. Check your details and try again.</p>}
      <Button disabled={submit.isPending} type="submit">{submit.isPending ? "Submitting…" : "Submit review"}</Button>
    </form></article>;
}