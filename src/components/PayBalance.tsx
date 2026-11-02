import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { captureOrder, createBalance, getPaypalConfig } from "@/lib/booking.functions";

type PP = { Buttons: (o: unknown) => { render: (el: HTMLElement) => Promise<void> } };

/** PayPal pay-now for a completed visit whose card hold had expired. */
export function PayBalance({ id, token }: { id: string; token: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const config = useServerFn(getPaypalConfig);
  const create = useServerFn(createBalance);
  const capture = useServerFn(captureOrder);
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await config();
      if (!cfg.ok) { setError(cfg.error); return; }
      const w = window as unknown as { paypal?: PP };
      if (!w.paypal || !document.querySelector("script[data-pp-capture]")) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.dataset.ppCapture = "1";
          s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.data.clientId)}&currency=USD&intent=capture`;
          s.onload = () => resolve(); s.onerror = () => reject();
          document.body.appendChild(s);
        }).catch(() => setError("Couldn't load PayPal. Please refresh."));
      }
      if (cancelled || !w.paypal || !ref.current) return;
      ref.current.innerHTML = "";
      await w.paypal.Buttons({
        style: { layout: "vertical", shape: "rect", label: "pay" },
        createOrder: async () => {
          const r = await create({ data: { id, token } });
          if (!r.ok) { setError(r.error); throw new Error(r.error); }
          return r.data.orderId;
        },
        onApprove: async (d: { orderID: string }) => {
          const r = await capture({ data: { orderId: d.orderID } });
          if (!r.ok) { setError(r.error); return; }
          router.invalidate();
        },
        onError: () => setError("PayPal ran into a problem. Please try again."),
      }).render(ref.current);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mt-6">
      <div ref={ref} className="min-h-12" />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
