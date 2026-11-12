import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { availableSlotCleaners } from '@/lib/appointment-slots.functions';
import { submitQuote } from '@/lib/service-quote.functions';
import type { ServiceQuoteInput } from '@/lib/service-quote';
import { AppointmentSlotPicker } from './AppointmentSlotPicker';
import { Button } from './ui/button';
export function ServiceQuoteBooking({quote}:{quote:Pick<ServiceQuoteInput,'mode'|'area'|'hours'|'cleaners'|'visits'|'size'|'notes'|'stairs'|'heavy'>}) {
 const [cleaner,setCleaner]=useState('');const [slot,setSlot]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const submit=useServerFn(submitQuote);const navigate=useNavigate();
 const choices=useQuery({queryKey:['quote-cleaners',quote.area],queryFn:()=>availableSlotCleaners({data:{area:quote.area}})});
 const field='mt-2 w-full min-w-0 rounded-md border border-input bg-background p-3 text-foreground';
 return <form className="mt-8 space-y-5 border-t border-border pt-6" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');try {const r=await submit({data:{...quote,cleanerId:cleaner,slotId:slot,customerName:String(f.get('name')),email:String(f.get('email')),phone:String(f.get('phone')),address:String(f.get('address'))}});await navigate({to:'/booking/$id',params:{id:r.id},search:{t:r.token}});}catch(e){setError(e instanceof Error?e.message:'Could not submit the quote.');}finally{setBusy(false);}}}>
 <h2 className="text-xl font-bold">Request appointment & phone review</h2>
 <label className="block text-sm font-semibold">Housekeeper<select required className={field} value={cleaner} onChange={e=>{setCleaner(e.target.value);setSlot('');}}><option value="">Choose a housekeeper</option>{choices.data?.map(c=><option key={c.id} value={c.id}>{c.display_name || 'Housekeeper'}</option>)}</select></label>
 {choices.isPending && <p role="status">Loading housekeepers…</p>}{choices.error && <p role="alert" className="text-destructive">Could not load housekeepers.</p>}{choices.isSuccess && choices.data.length===0 && <p className="text-sm text-muted-foreground">No available appointments in this area. Call (814) 952-1964.</p>}
 {cleaner && <AppointmentSlotPicker cleaner={cleaner} value={slot} onChange={s=>setSlot(s?.id ?? '')}/>}
 <div className="grid gap-4 sm:grid-cols-2">{[{name:'name',label:'Your name',type:'text'},{name:'email',label:'Email',type:'email'},{name:'phone',label:'Phone number for review',type:'tel'},{name:'address',label:'Service address',type:'text'}].map(f=><label key={f.name} className="text-sm font-semibold">{f.label}<input name={f.name} type={f.type} required maxLength={f.name==='address'?300:100} className={field}/></label>)}</div>
 <p className="text-sm text-muted-foreground">Your housekeeper calls to confirm scope, crew availability and the estimate. Payment opens after approval; the appointment is confirmed after payment. Office payment covers one visit, not the monthly total.</p>
 {error && <p role="alert" className="text-destructive">{error}</p>}<Button disabled={!slot || busy} type="submit">{busy?'Saving request…':'Send quote for phone review'}</Button>
 </form>;
}