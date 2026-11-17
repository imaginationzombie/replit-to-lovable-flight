import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { canPayTip } from "@/lib/tips";
import { payoutTip, checkOwnTipTransfer } from "@/lib/tips.functions";
import { Button } from "@/components/ui/button";
import { Banknote, RefreshCw } from "lucide-react";
import { housekeeperIncome } from "@/lib/housekeeper-income";

export function TipPayments({ admin = false, userId }: { admin?: boolean; userId?: string | undefined }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const qc = useQueryClient();
  const pay = useServerFn(payoutTip);
  const ownCheck = useServerFn(checkOwnTipTransfer);
  const tips = useQuery({ queryKey: ["cleaner-tips", admin, userId], enabled: admin || !!userId, refetchInterval: 15000, queryFn: async () => {
    let query = supabase.from("booking_tips").select("*,bookings(service,preferred_date)").eq("status", "paid").order("paid_at", { ascending: false });
    if (!admin && userId) query = query.eq("cleaner_id", userId);
    const { data, error } = await query; if (error) throw error; return data;
  } });
  const transfer = useMutation({ mutationFn: ({ id, send }: { id: string; send: boolean }) => admin ? pay({ data: { id, send, confirmed: true } }) : ownCheck({ data: { id } }), onSuccess: async () => { setConfirm(null); await Promise.all([qc.invalidateQueries({ queryKey: ["cleaner-tips"] }), qc.invalidateQueries({ queryKey: ["housekeeper-income"] })]); } });
  const liveTips = (tips.data ?? []).filter(t => t.environment === "live");
  const delivered = (tip: (typeof liveTips)[number]) => tip.payout_status === "paid" && !!tip.customer_confirmed_at && !!tip.payout_paid_at && !!tip.paypal_item_id;
  const tipIncome = housekeeperIncome([{ id: "summary", full_name: "" }], [], liveTips.map(t => ({ ...t, cleaner_id: "summary" })), [], [])[0];
  return <section className="mt-10 border-t border-border pt-6"><h2 className="text-xl font-bold">Customer tips</h2>
    <div className="mt-4 flex flex-wrap gap-8">{[["Collected", liveTips.reduce((sum,t) => sum + t.amount_cents, 0)], ["Customer-confirmed", tipIncome?.confirmedTips ?? 0], ["Delivered by PayPal", tipIncome?.settledTips ?? 0]].map(([label, value]) => <div key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">${(Number(value)/100).toFixed(2)}</p></div>)}</div>
    {tips.isLoading && <p role="status" className="mt-4">Loading tips…</p>}
    {(tips.error || transfer.error) && <p role="alert" className="mt-4 text-destructive">{(tips.error || transfer.error)?.message}</p>}
    {transfer.data && <p role="status" className="mt-4 text-primary">{transfer.data.message}</p>}
    {tips.isSuccess && !tips.data.length && <p className="mt-4 text-muted-foreground">No customer tips yet.</p>}
    <div className="mt-4 space-y-3">{tips.data?.map(tip => <article key={tip.id} className="rounded-lg border border-border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{tip.bookings?.service} · {tip.bookings?.preferred_date}</h3><span className="font-bold text-primary">${(tip.amount_cents/100).toFixed(2)}{tip.environment === "sandbox" ? " · Test" : ""}</span></div><p className="mt-2 text-sm text-muted-foreground">{delivered(tip) ? "Transferred to cleaner" : tip.payout_status === "paid" ? "Transfer recorded · delivery receipt unavailable" : tip.payout_status === "unpaid" ? "Collected · awaiting transfer" : `Transfer ${tip.payout_status.replaceAll("_", " ")}`}</p>
      {!tip.customer_confirmed_at && tip.payout_status === "unpaid" && <p className="mt-2 text-sm">{tip.confirmation_expires_at && Date.parse(tip.confirmation_expires_at) <= Date.now() ? "24-hour confirmation expired · held for review" : "Awaiting customer amount confirmation"}</p>}
      {tip.payout_error && <p className="mt-2 text-sm text-destructive">{tip.payout_error}</p>}
      {!admin && tip.paypal_batch_id && tip.payout_status !== "paid" && <Button variant="outline" className="mt-3" disabled={transfer.isPending} onClick={() => transfer.mutate({ id: tip.id, send: false })}><RefreshCw />Check transfer</Button>}
      {admin && (tip.payout_status !== "unpaid" || canPayTip(tip)) && (tip.payout_status === "unpaid" ? confirm === tip.id ? <div className="mt-3"><p className="mb-3 text-sm font-semibold">Transfer this ${tip.environment === "live" ? "real" : "test"} ${(tip.amount_cents/100).toFixed(2)} tip to the cleaner’s saved PayPal email?</p><div className="flex gap-2"><Button disabled={transfer.isPending} onClick={() => transfer.mutate({ id: tip.id, send: true })}><Banknote />Confirm transfer</Button><Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button></div></div> : <Button className="mt-3" onClick={() => setConfirm(tip.id)}><Banknote />Transfer tip</Button> : <Button variant="outline" className="mt-3" disabled={transfer.isPending} onClick={() => transfer.mutate({ id: tip.id, send: false })}><RefreshCw />Check transfer</Button>)}
    </article>)}</div>
  </section>;
}