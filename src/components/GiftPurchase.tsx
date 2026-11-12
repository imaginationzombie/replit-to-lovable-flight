import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { getPaypalConfig } from "@/lib/booking.functions";
import { purchaseGift, captureGift } from "@/lib/gift-certificates.functions";
export function GiftPurchase({ amountCents, recipientName, message }: { amountCents: 5000 | 10000 | 15000; recipientName: string; message: string }) {
 const container = useRef<HTMLDivElement>(null); const [error, setError] = useState(""); const config = useServerFn(getPaypalConfig); const start = useServerFn(purchaseGift); const finish = useServerFn(captureGift); const navigate = useNavigate();
 useEffect(() => { let cancelled = false; const purchaseId = crypto.randomUUID(); let giftId = "";
  (async () => { const cfg = await config(); if (!cfg.ok) throw new Error(cfg.error);
   type PP = { Buttons: (o: unknown) => { render: (el: HTMLElement) => Promise<void> } };
   const w = window as unknown as { giftPaypal?: PP };
   if (!w.giftPaypal) await new Promise<void>((resolve, reject) => { const s = document.createElement("script"); s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.data.clientId)}&currency=USD&intent=capture`; s.setAttribute("data-namespace", "giftPaypal"); s.onload = () => resolve(); s.onerror = () => reject(new Error("Could not load PayPal.")); document.body.appendChild(s); });
   if (cancelled || !w.giftPaypal || !container.current) return;
   await w.giftPaypal.Buttons({ style: { layout: "vertical", shape: "rect", label: "pay" }, createOrder: async () => { const r = await start({ data: { amountCents, recipientName, message, purchaseId } }); giftId = r.id; return r.orderId; }, onApprove: async (d: { orderID: string }) => { try { const r = await finish({ data: { id: giftId, orderId: d.orderID } }); await navigate({ to: "/gift/$id", params: { id: r.id }, search: { t: r.token } }); } catch(e) { setError(e instanceof Error ? e.message : "Check PayPal before paying again."); } }, onError: () => setError("PayPal could not finish checkout. Check PayPal before trying again.") }).render(container.current);
  })().catch(e => setError(e instanceof Error ? e.message : "Could not start checkout.")); return () => { cancelled = true; };
 }, [amountCents, recipientName, message]);
 return <div className="mt-5"><div ref={container} className="min-h-12" />{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</div>;
}