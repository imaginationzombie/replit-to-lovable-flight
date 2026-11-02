import { Star } from "lucide-react";
export function PublicReviews({ reviews }: { reviews: { id: string; rating: number; body: string; public_name: string; created_at: string }[] }) {
  const average = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null;
  return <section className="mt-10 border-t border-border pt-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">Customer reviews</h2>{average && <p className="flex items-center gap-2 font-semibold text-primary"><Star className="h-5 w-5 fill-primary" />{average}/5 · {reviews.length} reviews</p>}</div>
    {!reviews.length && <p className="mt-4 text-muted-foreground">No customer reviews yet.</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{reviews.map(r => <article key={r.id} className="rounded-md border border-border bg-card p-5"><div className="flex items-center justify-between gap-2"><h3 className="break-words font-bold">{r.public_name}</h3><span className="shrink-0 font-bold text-primary">{r.rating}/5</span></div><p className="mt-1 text-xs text-muted-foreground">Verified cleaning · {new Date(r.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })}</p><p className="mt-3 whitespace-pre-wrap break-words">{r.body}</p></article>)}</div>
  </section>;
}