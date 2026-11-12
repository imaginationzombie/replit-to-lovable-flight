import type { TipReceipt } from "@/lib/customer-history";
export function ClientTipSummary({ tip }: { tip?: TipReceipt | null }) {
 if (!tip) return <p className="mt-3 text-sm text-muted-foreground">No tip recorded</p>;
 const money = `$${(tip.amount_cents / 100).toFixed(2)}`;
 const received = tip.status === "paid" && Boolean(tip.paid_at);
 return <div className="mt-3 border-t border-border pt-3 text-sm"><p className="font-semibold">Tip: {money}{tip.environment !== "live" ? " · Test" : ""}</p><p className="mt-1 text-muted-foreground">{!received ? "Tip checkout pending" : tip.payout_status === "paid" && tip.payout_paid_at ? "Delivered to housekeeper" : !tip.customer_confirmed_at ? "Awaiting your amount confirmation" : "Confirmed · awaiting housekeeper payout"}</p>{received && !tip.customer_confirmed_at && tip.confirmation_expires_at && <p className="mt-1 text-muted-foreground">Confirmation deadline: {new Date(tip.confirmation_expires_at).toLocaleString("en-US", { timeZone: "America/New_York" })} Eastern</p>}</div>;
}