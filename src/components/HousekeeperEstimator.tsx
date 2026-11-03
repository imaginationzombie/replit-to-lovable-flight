import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ADD_ONS, SERVICE_BASE, SERVICE_AREAS, quote, addOnPrice } from "@/lib/pricing";

export function HousekeeperEstimator({ id, name, areas }: { id: string; name: string; areas: string }) {
  const [service, setService] = useState("Standard Housekeeping");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [addOns, setAddOns] = useState<string[]>([]);
  const q = quote({ service, bedrooms, bathrooms, addOns, rush: false });
  const field = "mt-2 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm";
  const draft = () => sessionStorage.setItem("hkb-booking-draft", JSON.stringify({ source: "estimator", service, bedrooms, bathrooms, addOns, serviceArea: SERVICE_AREAS.find(a => areas.toLowerCase().includes(a.toLowerCase())) }));
  return <section className="border-b border-border py-8" aria-labelledby="estimate-heading">
    <h2 id="estimate-heading" className="break-words text-2xl font-bold">Book with {name}</h2>
    <div className="mt-5 grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <label className="block text-sm font-semibold">Service<select className={field} value={service} onChange={e => setService(e.target.value)}>{Object.keys(SERVICE_BASE).map(s => <option key={s}>{s}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-semibold">Bedrooms<input type="number" min={1} max={10} className={field} value={bedrooms} onChange={e => setBedrooms(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} /></label>
          <label className="text-sm font-semibold">Bathrooms<input type="number" min={1} max={10} className={field} value={bathrooms} onChange={e => setBathrooms(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} /></label>
        </div>
        <fieldset><legend className="text-sm font-semibold">Add-ons</legend><div className="mt-2 grid gap-2">{Object.keys(ADD_ONS).map(a => <label key={a} className="flex min-w-0 items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={addOns.includes(a)} onChange={e => setAddOns(e.target.checked ? [...addOns, a] : addOns.filter(x => x !== a))} />{a}</span><span className="shrink-0 text-primary">{q.freeAddOns.includes(a) ? "Included" : `+$${addOnPrice(a).toFixed(2)}`}</span></label>)}</div></fieldset>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted-foreground">Estimated visit total</p><p className="mt-2 text-4xl font-extrabold text-primary">${q.total.toFixed(2)}</p>
        <p className="mt-3 text-sm text-muted-foreground">Includes 2 bedrooms and 1 bathroom. Extra bedrooms $15 each; extra bathrooms $10 each.</p>
        <p className="mt-2 text-sm text-muted-foreground">{q.includedHours} free add-ons included; additional add-ons 50% off.</p>
        <p className="mt-3 text-sm font-semibold text-primary">$0 charged today. Charged after your cleaning.</p>
        <Button asChild className="mt-5 h-auto min-h-11 max-w-full whitespace-normal py-3"><Link to="/book" search={{ housekeeper: id }} onClick={draft}>Choose appointment with {name}</Link></Button>
      </div>
    </div>
  </section>;
}