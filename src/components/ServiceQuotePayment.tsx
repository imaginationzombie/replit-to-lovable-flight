import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useRouter } from '@tanstack/react-router';
import { startQuotePayment, finishQuotePayment } from '@/lib/service-quote.functions';
import { Button } from './ui/button';
import { CreditCard } from 'lucide-react';
export function ServiceQuotePayment({id,token,amount}:{id:string;token:string;amount:number}) {
 const [open,setOpen]=useState(false);const [error,setError]=useState('');const container=useRef<HTMLDivElement>(null);
 const start=useServerFn(startQuotePayment);const finish=useServerFn(finishQuotePayment);const router=useRouter();
 useEffect(()=>{if(!open)return;let cancelled=false;let buttons:{render:(el:HTMLElement)=>Promise<void>;close:()=>Promise<void>}|undefined;
 (async()=>{const clientId=import.meta.env.VITE_LOVABLE_CONNECTOR_PAYPAL_CLIENT_ID;if(!clientId)throw new Error('PayPal is not connected.');
 type PP={Buttons:(options:unknown)=>{render:(el:HTMLElement)=>Promise<void>;close:()=>Promise<void>}};const w=window as unknown as {serviceQuotePaypal?:PP};
 if(!w.serviceQuotePaypal)await new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src=`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;s.setAttribute('data-namespace','serviceQuotePaypal');s.onload=()=>resolve();s.onerror=()=>reject(new Error('Could not load PayPal.'));document.body.appendChild(s);});
 if(cancelled || !w.serviceQuotePaypal || !container.current)return;
 buttons=w.serviceQuotePaypal.Buttons({style:{layout:'vertical',shape:'rect',label:'pay'},createOrder:async()=>{try{return(await start({data:{id,token}})).orderId;}catch(e){setError(e instanceof Error?e.message:'Checkout unavailable.');throw e;}},onApprove:async(d:{orderID:string})=>{try{await finish({data:{id,token,orderId:d.orderID}});await router.invalidate();}catch(e){setError(e instanceof Error?e.message:'Check PayPal before paying again.');}},onCancel:()=>setError('Payment cancelled. Your approved quote is still awaiting payment.'),onError:()=>setError('PayPal could not finish checkout. Check PayPal before trying again.')});await buttons.render(container.current);
 })().catch(e=>setError(e instanceof Error?e.message:'Could not open PayPal.'));return()=>{cancelled=true;void buttons?.close().catch(()=>{});};},[open,id,token]);
 return <section className="mt-6"><Button onClick={()=>setOpen(true)} disabled={open}><CreditCard/>Pay ${(amount/100).toFixed(2)} with PayPal</Button>{open && <div ref={container} className="mt-4 min-h-12"/>}{error && <p role="alert" className="mt-3 text-destructive">{error}</p>}</section>;
}