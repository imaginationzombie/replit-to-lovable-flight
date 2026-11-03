import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CleaningLevelPicker } from "@/components/CleaningLevelPicker";
import { type CleaningLevel } from "@/lib/pricing";
import { ADD_ONS, SERVICE_BASE, SERVICE_AREAS, quote, addOnPrice } from "@/lib/pricing";

export function HousekeeperEstimator({ id, name, areas }: { id: string; name: string; areas: string }) {
  const [service, setService] = useState("Standard Housekeeping");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [cleaningLevel, setCleaningLevel] = useState<CleaningLevel>("Light");
  const q = quote({ service, bedrooms, bathrooms, addOns, rush: false, cleaningLevel });
  const field = "mt-2 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm";
  const draft = () => sessionStorage.setItem("hkb-booking-draft", JSON.stringify({ source: "estimator", service, bedrooms, bathrooms, addOns, cleaningLevel, serviceArea: SERVICE_AREAS.find(a => areas.toLowerCase().includes(a.toLowerCase())) }));
  return <section className="border-b border-border py-8" aria-labelledby="estimate-heading">
    <div className="mb-8 border-b border-border pb-6">
      <p className="text-sm font-semibold text-primary">First-cleaning offers</p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">A fresh start for your home</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 border-l-4 border-primary bg-accent px-4 py-5">
          <h3 className="text-lg font-semibold text-accent-foreground">First 1-hour cleaning</h3>
          <p className="mt-2 text-4xl font-extrabold text-primary">$35</p>
        </div>
        <div className="min-w-0 border-l-4 border-secondary bg-muted px-4 py-5">
          <h3 className="text-lg font-semibold text-foreground">First 2-hour cleaning</h3>
          <p className="mt-2 text-4xl font-extrabold text-primary">$65</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Introductory offers advertised here are not applied automatically. Standard prices are shown in the estimator and at checkout.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="min-w-0"><h3 className="font-bold text-primary">1 free add-on per cleaning hour</h3><p className="mt-1 text-sm text-muted-foreground">Based on your service’s included hours. Your most expensive selected add-ons are free first.</p></div>
        <div className="min-w-0"><h3 className="font-bold text-primary">50% off extra add-ons</h3><p className="mt-1 text-sm text-muted-foreground">Every remaining add-on is half price.</p></div>
      </div>
    </div>
    <h2 id="estimate-heading" className="break-words text-2xl font-bold">Book with {name}</h2>
    <div className="mt-5 grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <label className="block text-sm font-semibold">Service<select className={field} value={service} onChange={e => setService(e.target.value)}>{Object.keys(SERVICE_BASE).map(s => <option key={s}>{s}</option>)}</select></label>
        <CleaningLevelPicker value={cleaningLevel} onChange={setCleaningLevel} />
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