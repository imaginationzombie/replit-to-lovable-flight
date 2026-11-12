import { createFileRoute } from '@tanstack/react-router';
import { ServiceEstimate } from '@/components/ServiceEstimate';
export const Route = createFileRoute('/moving-quote')({
 head:()=>({meta:[{title:'Moving Labor Estimates | HousekeepingBooking.com'},{name:'description',content:'Estimate two-person moving labor for loading, unloading and packing in Central Pennsylvania.'},{property:'og:title',content:'Moving Labor Estimates | HousekeepingBooking.com'},{property:'og:description',content:'Get a moving labor estimate for a two-person crew; truck and transport quoted separately.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:()=> <ServiceEstimate mode="moving"/>,
});
