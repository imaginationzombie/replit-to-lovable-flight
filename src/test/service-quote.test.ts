import { expect, it } from 'vitest';
import { canPayServiceQuote, serviceQuoteCents } from '../lib/service-quote';
import { giftReceiptMatches } from '../lib/gift-certificates';
it('office payment is the displayed $64.80 visit estimate, not four visits',()=>{expect(serviceQuoteCents({mode:'office',hours:2,cleaners:1,visits:4,area:'Lewistown, PA'})).toBe(6480);});
it('moving payment is the displayed $270 estimate',()=>{expect(serviceQuoteCents({mode:'moving',hours:3,cleaners:2,visits:1,area:'Lewistown, PA'})).toBe(27000);});
it('requires phone approval before payment',()=>{expect(canPayServiceQuote({status:'pending_payment',quote_reviewed_at:null,paid_at:null})).toBe(false);expect(canPayServiceQuote({status:'pending_payment',quote_reviewed_at:'2026-11-12T19:00:00Z',paid_at:null})).toBe(true);});
it('rejects receipts that do not match the saved quote amount',()=>{const receipt={status:'COMPLETED',purchase_units:[{reference_id:'quote',payments:{captures:[{id:'capture',status:'COMPLETED',amount:{value:'64.80',currency_code:'USD'}}]}}]};expect(giftReceiptMatches(receipt,'quote',6480)).toBe(true);expect(giftReceiptMatches(receipt,'quote',6481)).toBe(false);});