import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { serviceQuoteSchema } from './service-quote';
const access=z.object({id:z.string().uuid(),token:z.string().uuid()});
export const submitQuote=createServerFn({method:'POST'}).inputValidator((d:unknown)=>serviceQuoteSchema.parse(d)).handler(async({data})=>{
 const {userIdFromBearer}=await import('./booking.server'); const {submitServiceQuote}=await import('./service-quote.server');
 return submitServiceQuote(data,await userIdFromBearer(getRequestHeader('authorization')));
});
export const startQuotePayment=createServerFn({method:'POST'}).inputValidator((d:unknown)=>access.parse(d)).handler(async({data})=>{const {startServiceQuotePayment}=await import('./service-quote.server');return startServiceQuotePayment(data.id,data.token);});
export const finishQuotePayment=createServerFn({method:'POST'}).inputValidator((d:unknown)=>access.extend({orderId:z.string().min(5).max(64)}).parse(d)).handler(async({data})=>{const {finishServiceQuotePayment}=await import('./service-quote.server');return finishServiceQuotePayment(data.id,data.token,data.orderId);});
export const reviewQuote=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({id:z.string().uuid(),approve:z.boolean(),notes:z.string().trim().min(5).max(1500)}).parse(d)).handler(async({data,context})=>{
 const {error}=await context.supabase.rpc('review_service_quote',{_booking:data.id,_approve:data.approve,_notes:data.notes}); if(error) throw new Error(error.message);
 const {quoteUpdate}=await import('./service-quote.server');await quoteUpdate(data.id,data.approve?'approved':'declined');return {ok:true};
});