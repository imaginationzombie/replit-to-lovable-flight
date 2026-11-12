import type { ServiceQuoteInput } from './service-quote';
import { canPayServiceQuote, serviceQuoteCents } from './service-quote';
import { quotePaypal } from './service-quote-paypal.server';
import { giftReceiptMatches } from './gift-certificates';
import { notifyBookingEvent } from './booking-notices.server';
import { sendTemplateEmail } from './email-templates/send-email';
import { slotLabel } from './appointment-slots';
async function db() { const {supabaseAdmin} = await import('@/integrations/supabase/client.server'); return supabaseAdmin; }
export async function quoteUpdate(id:string,event:'requested'|'approved'|'declined') {
 const client=await db(); const {data:b}=await client.from('bookings').select('*').eq('id',id).single();
 if (!b?.service_quote || !b.cleaner_id) return;
 const props={ service:b.service, customer:b.customer_name, phone:b.phone, email:b.email,address:b.address,date:b.preferred_date,time:slotLabel({start_time:b.appointment_start ?? '08:00',end_time:b.appointment_end ?? '12:00'}),amount:`$${(b.amount_cents/100).toFixed(2)}`,notes:b.notes };
 const url=`https://housekeepingbooking.com/booking/${b.id}?t=${b.access_token}`;
 const send=async (email:string,heading:string,message:string,link:string,suffix:string)=>{try {await sendTemplateEmail('service-quote-update',email,{templateData:{...props,heading,message,url:link},idempotencyKey:`service-quote-${b.id}-${event}-${suffix}`});}catch(e){console.error('Service quote email failed',e instanceof Error ? e.message : 'send failed');}};
 if(event==='requested') {
  const {data:account}=await client.auth.admin.getUserById(b.cleaner_id);
  if(account.user?.email) await send(account.user.email,'Phone review requested','Call the customer to verify the scope, crew and saved price, then approve or decline this quote in your dashboard. This is a request, not a confirmed appointment.','https://housekeepingbooking.com/cleaner','cleaner');
 }
 await send(b.email,event==='requested'?'Your quote is awaiting phone review':event==='approved'?'Your quote is approved — payment ready':'Your quote was declined',event==='requested'?'Your housekeeper will call to review the job and crew availability. No payment has been taken.':event==='approved'?'Your housekeeper approved this estimate after phone review. Pay the saved amount with PayPal to confirm this appointment. Office payments cover one visit only.':'Please contact us to discuss a new quote. No payment has been taken.',url,'customer');
}
export async function submitServiceQuote(input:ServiceQuoteInput,userId:string|null) {
 const client=await db();
 const {data:slot,error}=await client.rpc('public_appointment_slots',{_cleaner:input.cleanerId});
 const selected=slot?.find(s=>s.id===input.slotId);
 if(error || !selected) throw new Error('This appointment is no longer available. Choose another slot.');
 const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
 if(minutes(selected.end_time)-minutes(selected.start_time)<input.hours*60) throw new Error('Choose an appointment slot long enough for the quoted hours.');
 const amount=serviceQuoteCents(input);
 const {data:b,error:saveError}=await client.from('bookings').insert({customer_name:input.customerName,email:input.email,phone:input.phone,address:input.address,service_area:input.area,service:input.mode==='office'?'Office cleaning':'Moving labor',frequency:'One-time',bedrooms:0,bathrooms:0,preferred_date:selected.slot_date,time_window:'Morning (8am–12pm)',amount_cents:amount,notes:`${input.mode==='office' ? `Office size: ${input.size || 'Not specified'}. ${input.cleaners} cleaner(s); ${input.visits} planned visits/month (this payment is one visit).` : `Moving scope: ${input.size}. Two-person crew. Stairs/long carry: ${input.stairs?'Yes':'No'}. Heavy items: ${input.heavy?'Yes':'No'}.` }\n${input.notes}`,user_id:userId,requested_cleaner_id:input.cleanerId,cleaner_id:input.cleanerId,appointment_slot_id:input.slotId,service_quote:{mode:input.mode,hours:input.hours,cleaners:input.cleaners,visits:input.visits,size:input.size,stairs:input.stairs,heavy:input.heavy},quote_payment_environment:'live'}).select('id,access_token').single();
 if(saveError || !b) throw new Error(saveError?.message || 'Could not save your quote.');
 await quoteUpdate(b.id,'requested'); return {id:b.id,token:b.access_token};
}
export async function startServiceQuotePayment(id:string,token:string) {
 const client=await db(); const {data:b}=await client.from('bookings').select('*').eq('id',id).eq('access_token',token).single();
 if(!b?.service_quote || !canPayServiceQuote(b)) throw new Error('Your housekeeper must approve the quote by phone before payment.');
 if(!b.appointment_start || new Date(`${b.preferred_date}T${b.appointment_start}-05:00`).getTime()<=Date.now()) throw new Error('This appointment time has passed. Contact your housekeeper before paying.');
 if(b.paypal_order_id) return {orderId:b.paypal_order_id};
 const response=await quotePaypal('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:b.id,description:`${b.service} — HousekeepingBooking.com`,amount:{currency_code:'USD',value:(b.amount_cents/100).toFixed(2)}}]},`sq-${b.id}`);
 const order=await response.json() as {id?:string}; if(!order.id) throw new Error('PayPal did not return checkout.');
 const {error}=await client.from('bookings').update({paypal_order_id:order.id,payment_checkout_started:true}).eq('id',id).eq('status','pending_payment');
 if(error) throw new Error('Checkout could not be saved. Do not pay; contact us.'); return {orderId:order.id};
}
export async function finishServiceQuotePayment(id:string,token:string,orderId:string) {
 const client=await db(); const {data:b}=await client.from('bookings').select('*').eq('id',id).eq('access_token',token).eq('paypal_order_id',orderId).single();
 if(!b?.service_quote || !b.quote_reviewed_at || (b.status!=='pending_payment' && b.status!=='confirmed')) throw new Error('Approved quote not found.');
 if(!b.paid_at) {
  let response=await quotePaypal(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  type Receipt=Parameters<typeof giftReceiptMatches>[0]; let receipt=await response.json() as Receipt;
  if(receipt.status!=='COMPLETED') {response=await quotePaypal(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,'POST',{},`sq-cap-${id}`);receipt=await response.json() as Receipt;}
  if(!giftReceiptMatches(receipt,b.id,b.amount_cents)) throw new Error('Payment is not confirmed. Check PayPal before paying again.');
  const capture=receipt.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  if(!capture) throw new Error('Payment receipt unavailable.');
  const {error}=await client.from('bookings').update({status:'confirmed',paid_at:new Date().toISOString(),paypal_capture_id:capture,quote_payment_environment:'live'}).eq('id',id).eq('status','pending_payment');
  if(error) throw new Error('PayPal received payment, but the appointment needs attention. Contact us; do not pay again.');
 }
 await notifyBookingEvent(client,id,'confirmed'); await notifyBookingEvent(client,id,'paid'); return {paid:true};
}