import { z } from 'zod';
import { SERVICE_AREAS } from './pricing';
import { movingEstimate, officeEstimate } from './service-estimates';
export const serviceQuoteSchema = z.object({
 mode: z.enum(['office','moving']), area: z.string().refine(a => SERVICE_AREAS.includes(a)),
 hours: z.number().min(2).max(12), cleaners: z.number().int().min(1).max(2), visits: z.number().int().min(1).max(31),
 size: z.string().max(100), notes: z.string().trim().max(1500), stairs: z.boolean(), heavy: z.boolean(),
 customerName: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254),
 phone: z.string().trim().min(7).max(30), address: z.string().trim().min(5).max(300),
 cleanerId: z.string().uuid(), slotId: z.string().uuid(),
});
export type ServiceQuoteInput = z.infer<typeof serviceQuoteSchema>;
export function serviceQuoteCents(q: Pick<ServiceQuoteInput,'mode'|'hours'|'cleaners'|'visits'|'area'>) {
 return Math.round((q.mode === 'office' ? officeEstimate(q.hours,q.cleaners,q.visits).perVisit : movingEstimate(q.hours,q.area).total)*100);
}
export function canPayServiceQuote(b: { status: string; quote_reviewed_at: string | null; paid_at: string | null }) {
 return b.status === 'pending_payment' && Boolean(b.quote_reviewed_at) && !b.paid_at;
}