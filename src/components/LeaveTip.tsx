import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPaypalConfig } from "@/lib/booking.functions";
import { createTip, captureTip, tipDetails, confirmTip } from "@/lib/tips.functions";

import { canConfirmTip } from "@/lib/tips";

type PayPal = { Buttons: (options: unknown) => { render: (el: HTMLElement) => Promise<void>; close: () => void } };
export function LeaveTip({ id, token }: { id: string; token: string }) {
  const [amount, setAmount] = useState("10");
  const [checkout, setCheckout] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const config = useServerFn(getPaypalConfig);
  const create = useServerFn(createTip);
  const capture = useServerFn(captureTip);
  const details = useServerFn(tipDetails);
  const qc = useQueryClient();
  const confirmFn = useServerFn(confirmTip);
  const confirmation = useMutation({ mutationFn: () => confirmFn({ data: { id, token, confirmed: true } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-tip", id] }) });
  const receipt = useQuery({ queryKey: ["customer-tip", id], queryFn: () => details({ data: { id, token } }) });
  const cents = Math.round(Number(amount) * 100);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && cents >= 100 && cents <= 50000;
  useEffect(() => {
    if (!checkout) return;
    let cancelled = false;
    let buttons: ReturnType<PayPal["Buttons"]> | undefined;
    (async () => {
      try {
        const cfg = await config();
        if (!cfg.ok) throw new Error(cfg.error);
        const w = window as unknown as { tipPayPal?: PayPal };
        if (!w.tipPayPal) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.setAttribute("data-namespace", "tipPayPal");
            s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.data.clientId)}&currency=USD&intent=capture`;
            s.onload = () => resolve(); s.onerror = () => reject(new Error("Could not load PayPal. Please try again."));
            document.body.appendChild(s);
          });
        }
        if (cancelled || !w.tipPayPal || !ref.current) return;
        buttons = w.tipPayPal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "pay" },
          createOrder: async () => { try { return (await create({ data: { id, token, amountCents: cents } })).orderId; } catch (e) { setError(e instanceof Error ? e.message : "Could not start tip payment."); throw e; } },
          onApprove: async (d: { orderID: string }) => {
            try { await capture({ data: { id, token, orderId: d.orderID } }); await qc.invalidateQueries({ queryKey: ["customer-tip", id] }); setCheckout(false); }
            catch (e) { setError(e instanceof Error ? e.message : "Could not confirm tip. Check PayPal before paying again."); }
          },
          onCancel: () => { setCheckout(false); setError("Tip payment cancelled. Nothing was charged."); },
          onError: () => setError(old => old || "PayPal could not confirm the tip. Check PayPal before trying again."),
        });
        await buttons.render(ref.current);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load PayPal."); }
    })();
    return () => { cancelled = true; buttons?.close(); };
  }, [checkout, cents, id, token, config, create, capture, qc]);
  if (receipt.isLoading) return <p className="mt-6 text-sm text-muted-foreground" role="status">Loading tip options…</p>;
  if (receipt.isError) return <p role="alert" className="mt-6 text-destructive">Could not load your tip receipt. Refresh before paying.</p>;
  if (receipt.data?.status === "paid") return <section className="mt-6 border-t border-border pt-6"><h2 className="font-semibold text-primary">Tip received: ${(receipt.data.amount_cents / 100).toFixed(2)}{receipt.data.environment === "sandbox" ? " · Test" : ""}</h2>
    {receipt.data.customer_confirmed_at ? <p className="mt-3">Amount confirmed · {receipt.data.payout_status === "paid" ? "Delivered to cleaner" : "Payout awaiting completion"}</p> : canConfirmTip(receipt.data) ? <><p className="mt-3 text-sm">Confirm by {new Date(receipt.data.confirmation_expires_at ?? "").toLocaleString("en-US", { timeZone: "America/New_York" })} Eastern. The tip is paid to your cleaner only after confirmation.</p><Button className="mt-4" disabled={confirmation.isPending} onClick={() => confirmation.mutate()}>Confirm ${(receipt.data.amount_cents / 100).toFixed(2)} tip</Button></> : <p className="mt-3 text-sm">Confirmation unavailable or expired · held for review. Contact us; no automatic payout or refund.</p>}
    {confirmation.error && <p role="alert" className="mt-3 text-destructive">{confirmation.error.message}</p>}{confirmation.data && <p role="status" className="mt-3">{confirmation.data.message}</p>}
  </section>;
  return <section className="mt-6 border-t border-border pt-6">
    <h2 className="flex items-center gap-2 text-lg font-bold"><Heart className="h-5 w-5 text-primary" />Leave your cleaner a tip</h2>
    {receipt.data && <p className="mt-2 text-sm text-muted-foreground">Resume your ${(receipt.data.amount_cents / 100).toFixed(2)} tip checkout.</p>}
    <fieldset disabled={checkout} className="mt-4 flex flex-wrap gap-3"><legend className="sr-only">Tip amount</legend>{[5, 10, 20].map(value => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name={`tip-${id}`} checked={amount === String(value)} onChange={() => setAmount(String(value))} />${value}</label>)}</fieldset>
    <label className="mt-4 block text-sm font-semibold">Custom tip ($)<Input type="number" min="1" max="500" step="0.01" value={amount} disabled={checkout} onChange={e => setAmount(e.target.value)} className="mt-2 max-w-48" /></label>
    {!checkout ? <Button className="mt-4" disabled={!valid} onClick={() => { setError(""); setCheckout(true); }}><Heart />Tip ${valid ? (cents / 100).toFixed(2) : "—"} with PayPal</Button> : <div className="mt-4 max-w-sm"><div ref={ref} className="min-h-12" /><Button variant="ghost" className="mt-2" onClick={() => setCheckout(false)}>Back</Button></div>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </section>;
}