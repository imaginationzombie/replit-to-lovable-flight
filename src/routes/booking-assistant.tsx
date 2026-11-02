import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getRecommendation } from "@/lib/recommend.functions";
import type { Recommendation } from "@/lib/recommend.server";

export const Route = createFileRoute("/booking-assistant")({
  head: () => ({
    meta: [
      { title: "AI Booking Assistant | HousekeeperBooking.com" },
      { name: "description", content: "Describe your home and schedule and get a recommended cleaning service with booking details ready." },
      { property: "og:title", content: "AI Booking Assistant | HousekeeperBooking.com" },
      { property: "og:description", content: "Get a recommended cleaning service and ready-to-book details in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingAssistant,
});

const EXAMPLE =
  "3 bedroom, 2 bath house in Brookville with two dogs. Haven't had a proper clean in months — kitchen and bathrooms need the most work, and the fridge is a mess. I'd like someone every other week, ideally Tuesday mornings.";

function BookingAssistant() {
  const recommend = useServerFn(getRecommendation);
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 15) {
      setError("Tell us a little more about your home and what you need.");
      return;
    }
    setLoading(true);
    setError(null);
    setRec(null);
    try {
      const res = await recommend({ data: { description } });
      if (res.ok) setRec(res.recommendation);
      else setError(res.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const summary = rec
    ? [
        `Service: ${rec.service} (${rec.frequency})`,
        `Home: ${rec.bedrooms} bed / ${rec.bathrooms} bath${rec.serviceArea ? ` in ${rec.serviceArea}` : ""}`,
        `Add-ons: ${rec.addOns.length ? rec.addOns.join(", ") : "None"}`,
        `Crew: ${rec.crewSize} • About ${rec.estimatedHours} hrs`,
        `Preferred: ${rec.preferredDay}, ${rec.preferredTimeWindow}`,
        rec.specialNotes ? `Notes: ${rec.specialNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href="/index.html" className="text-lg font-extrabold text-primary">HousekeeperBooking.com</a>
          <a href="tel:8149521964" className="text-sm font-semibold text-muted-foreground hover:text-primary">(814) 952-1964</a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">AI-powered booking assistant</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">Tell us about your home</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Describe your home, what needs cleaning, and when works for you. We'll recommend the right service and get your booking details ready.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <label htmlFor="desc" className="text-sm font-bold text-foreground">Your home, needs & schedule</label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={9}
              maxLength={4000}
              placeholder={EXAMPLE}
              className="mt-2 w-full resize-y rounded-xl border border-input bg-background p-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-2 flex items-center justify-between">
              <button type="button" onClick={() => setDescription(EXAMPLE)} className="text-xs font-semibold text-primary hover:underline">
                Use an example
              </button>
              <span className="text-xs text-muted-foreground">{description.length}/4000</span>
            </div>
            {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Preparing your recommendation…" : "Get my recommendation"}
            </button>
          </form>

          <section aria-live="polite" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {!rec && !loading && (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <p className="font-semibold text-foreground">Your recommendation will appear here</p>
                <p className="mt-1 text-sm">Includes service, add-ons, crew size and time estimate.</p>
              </div>
            )}
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-muted" />
                ))}
              </div>
            )}
            {rec && (
              <div>
                <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">Recommended</span>
                <h2 className="mt-3 text-2xl font-extrabold text-foreground">{rec.service}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{rec.reason}</p>

                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Item label="Frequency" value={rec.frequency} />
                  <Item label="Home" value={`${rec.bedrooms} bed / ${rec.bathrooms} bath`} />
                  <Item label="Crew" value={`${rec.crewSize} cleaner${rec.crewSize > 1 ? "s" : ""}`} />
                  <Item label="Est. time" value={`~${rec.estimatedHours} hrs`} />
                  <Item label="Preferred day" value={rec.preferredDay} />
                  <Item label="Time window" value={rec.preferredTimeWindow} />
                  {rec.serviceArea && <Item label="Area" value={rec.serviceArea} />}
                </dl>

                {rec.addOns.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Suggested add-ons</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {rec.addOns.map((a) => (
                        <span key={a} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {rec.specialNotes && <p className="mt-4 text-sm text-foreground"><strong>Notes:</strong> {rec.specialNotes}</p>}
                {rec.questionsForCustomer.length > 0 && (
                  <div className="mt-4 rounded-xl bg-muted p-4">
                    <p className="text-xs font-bold uppercase text-muted-foreground">A few quick questions</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                      {rec.questionsForCustomer.map((q) => <li key={q}>{q}</li>)}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem("hkb-booking-draft", JSON.stringify(rec));
                      navigate({ to: "/book" });
                    }}
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
                  >
                    Continue to booking
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(summary);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-foreground hover:bg-muted"
                  >
                    {copied ? "Copied!" : "Copy booking details"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}
