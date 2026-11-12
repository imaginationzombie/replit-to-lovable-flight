import { createFileRoute } from '@tanstack/react-router';
import { ServiceEstimate } from '@/components/ServiceEstimate';
export const Route = createFileRoute('/office-quote')({
 head:()=>({meta:[{title:'Office Cleaning Estimates | HousekeepingBooking.com'},{name:'description',content:'Estimate office cleaning by crew hours and visits in Central Pennsylvania.'},{property:'og:title',content:'Office Cleaning Estimates | HousekeepingBooking.com'},{property:'og:description',content:'Get an office cleaning estimate based on your crew and schedule.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:()=> <ServiceEstimate mode="office"/>,
});
