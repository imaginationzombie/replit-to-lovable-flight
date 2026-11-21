import { useState, useEffect } from 'react';
import { useServiceTowns } from '@/hooks/use-service-towns';
import { activeTownSelection } from '@/lib/service-towns';
import { useHydrated } from '@tanstack/react-router';
import { Building2, Truck, Phone, Printer } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { Button } from './ui/button';
import { SERVICE_AREAS } from '@/lib/pricing';
import { officeEstimate, movingEstimate, ESTIMATE_SOURCES } from '@/lib/service-estimates';
import { ServiceQuoteBooking } from './ServiceQuoteBooking';
export function ServiceEstimate({ mode }: { mode: 'office' | 'moving' }) {
 const office = mode === 'office';
 const hydrated = useHydrated();
 const [area,setArea] = useState(SERVICE_AREAS[0] ?? '');
 const towns = useServiceTowns();
 useEffect(() => { if(towns.isSuccess) setArea(current => activeTownSelection(current,towns.areas)); },[towns.data,towns.isSuccess]);
 const [hours,setHours] = useState(2);const [cleaners,setCleaners] = useState(1);const [visits,setVisits] = useState(1);
 const [size,setSize] = useState('');const [notes,setNotes] = useState('');
 const [stairs,setStairs] = useState(false);const [heavy,setHeavy] = useState(false);
 const safeHours = Math.max(2,Math.min(office ? 8 : 12,hours));
 const oq = officeEstimate(Math.min(8,safeHours),cleaners,Math.max(1,Math.min(31,visits)));const mq=movingEstimate(safeHours,area);
 const money=(n:number)=>'$'+n.toFixed(2);
 const field='mt-2 w-full min-w-0 rounded-md border border-input bg-background p-3 text-foreground';
 const source=office ? ESTIMATE_SOURCES.office : area==='Lewistown, PA' ? ESTIMATE_SOURCES.lewistown : ESTIMATE_SOURCES.dubois;
 return <div className="min-h-screen bg-background"><AppHeader/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6" aria-busy={!hydrated}>
 <div className="flex items-center gap-3 text-primary">{office ? <Building2 className="h-8 w-8"/> : <Truck className="h-8 w-8"/>}<h1 className="text-3xl font-bold">{office ? 'Office cleaning estimate' : 'Moving labor estimate'}</h1></div>
 <p className="mt-4 text-muted-foreground">{office ? 'Desks, floors, restrooms and breakrooms.' : 'Two movers for loading, unloading, packing or moving furniture.'}</p>
 <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]"><section className="min-w-0 space-y-6"><h2 className="border-b border-border pb-3 text-xl font-bold">Job details</h2>
 <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Service location<select className={field} value={area} onChange={e=>setArea(e.target.value)}>{towns.areas.map(a=><option key={a}>{a}</option>)}</select>{towns.error && <p role="alert">Could not load service towns.</p>}</label>
 <label className="text-sm font-semibold">{office ? 'Cleaning hours per visit' : 'Crew hours'}<input className={field} type="number" min={2} max={office ? 8 : 12} step="0.5" value={hours} onChange={e=>setHours(Number(e.target.value))}/></label>
 {office ? <><label className="text-sm font-semibold">Cleaners<select className={field} value={cleaners} onChange={e=>setCleaners(Number(e.target.value))}><option value={1}>1 cleaner</option><option value={2}>2 cleaners</option></select></label><label className="text-sm font-semibold">Visits per month<input className={field} type="number" min={1} max={31} value={visits} onChange={e=>setVisits(Math.round(Number(e.target.value)))}/></label><label className="text-sm font-semibold sm:col-span-2">Office size (square feet, optional)<input className={field} type="number" min={0} value={size} onChange={e=>setSize(e.target.value)}/></label></> : <><label className="text-sm font-semibold sm:col-span-2">Moving scope<select className={field} value={size} onChange={e=>setSize(e.target.value)}><option value="">Choose scope</option><option>Load a truck or container</option><option>Unload a truck or container</option><option>Pack belongings</option><option>Move furniture within the home</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stairs} onChange={e=>setStairs(e.target.checked)}/>Stairs or long carry</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={heavy} onChange={e=>setHeavy(e.target.checked)}/>Heavy or specialty items</label></>}
 <label className="text-sm font-semibold sm:col-span-2">{office ? 'Rooms, restrooms & cleaning requirements' : 'Pickup, destination & item details'}<textarea rows={4} className={field} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1500}/></label></div></section>
 <aside className="min-w-0 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><h2 className="text-xl font-bold">Estimated {office ? 'cleaning price' : 'labor price'}</h2><p className="mt-4 text-4xl font-bold text-primary" aria-live="polite">{money(office ? oq.perVisit : mq.total)}</p><p className="mt-2 text-sm text-muted-foreground">{office ? `Per visit · ${cleaners} cleaner${cleaners===1?'':'s'} · ${oq.billableHours} hours` : `2 movers · ${mq.billableHours} hours · ${money(mq.rate)}/crew hour`}</p>
 {office && <p className="mt-4 font-semibold">{visits} visits/month: {money(oq.total)}</p>}
 <div className="mt-6 space-y-3 border-y border-border py-5 text-sm"><p>10% below the selected published comparison.</p><p className="text-muted-foreground">{office ? `Johnstown comparison: ${money(oq.benchmark)} per visit before tax/chemical fees.` : `${area==='Lewistown, PA'?'Lewistown':'DuBois-area'} comparison: ${money(mq.benchmarkRate)}/hour for a two-person crew.`}</p><a href={source} target="_blank" rel="noreferrer" className="text-primary underline">View published comparison</a><p className="text-xs text-muted-foreground">Checked November 12, 2026. Competitor availability and prices can change.</p></div>
 <p className="mt-5 text-sm text-muted-foreground">Estimate subject to housekeeper phone review and crew availability. {office ? 'Tax, special chemicals and specialty floor work are not included.' : 'Labor only: truck, transport, fuel, packing materials and specialty-item handling are not included.'} Pay this estimate with PayPal after approval to confirm your appointment.</p>
 {!office && (stairs || heavy) && <p className="mt-3 text-sm text-primary">Stairs or specialty items need a reviewed estimate before scheduling.</p>}
 <div className="mt-6 flex flex-wrap gap-3"><Button asChild><a href="tel:8149521964"><Phone/>Review estimate by phone</a></Button><Button variant="outline" onClick={()=>window.print()}><Printer/>Print estimate</Button></div></aside></div>{towns.areas.includes(area) && <ServiceQuoteBooking key={area} quote={{mode,area,hours:safeHours,cleaners,visits:Math.max(1,Math.min(31,visits)),size,notes,stairs,heavy}}/>}</main></div>;
}
