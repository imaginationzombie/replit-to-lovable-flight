import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authorizeOrder, getPaypalConfig, resumeBookingCheckout } from "@/lib/booking.functions";
import { refreshBookingViews } from "@/lib/booking-sync";
type Paypal = { Buttons: (options: unknown) => { render: (element: HTMLElement) => Promise<void>; close: () => void } };
export function EstimateCheckout({ id, token }: { id: string; token: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const config = useServerFn(getPaypalConfig);
  const create = useServerFn(resumeBookingCheckout);
  const authorize = useServerFn(authorizeOrder);
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    let buttons: ReturnType<Paypal["Buttons"]> | undefined;
    (async () => {
      const cfg = await config();
      if (!cfg.ok) throw new Error(cfg.error);
      const w = window as unknown as { paypalEstimate?: Paypal };
      if (!w.paypalEstimate) await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.data.clientId)}&currency=USD&intent=authorize`;
        script.dataset["namespace"] = "paypalEstimate";
        script.onload = () => resolve(); script.onerror = () => reject(new Error("Could not load PayPal. Please refresh."));
        document.body.appendChild(script);
      });
      if (cancelled || !ref.current || !w.paypalEstimate) return;
      buttons = w.paypalEstimate.Buttons({
        style: { layout: "vertical", shape: "rect", label: "paypal" },
        createOrder: async () => { const r = await create({ data: { id, token } }); if (!r.ok) { setError(r.error); throw new Error(r.error); } return r.data.orderId; },
        onApprove: async (d: { orderID: string }) => { const r = await authorize({ data: { orderId: d.orderID } }); if (!r.ok) { setError(r.error); return; } await refreshBookingViews(qc); await router.invalidate(); },
        onError: () => setError("PayPal could not finish checkout. Please try again."),
      });
      await buttons.render(ref.current);
    })().catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load checkout."); });
    return () => { cancelled = true; buttons?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);
  return <section className="mt-6 border-t border-border pt-5"><h2 className="text-lg font-bold">Finish booking · $0 charged today</h2><div ref={ref} className="mt-4 min-h-12" />{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</section>;
}