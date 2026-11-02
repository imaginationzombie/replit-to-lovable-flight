import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { payoutConfig, sendCleanerPayout, checkCleanerPayout } from "@/lib/payouts.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Banknote, RefreshCw } from "lucide-react";

export function PayoutTransfer({ workId, cleanerId, amount, admin }: { workId: string; cleanerId: string; amount: number; admin: boolean }) {
  const qc = useQueryClient(); const [open, setOpen] = useState(false); const [message, setMessage] = useState("");
  const getConfig = useServerFn(payoutConfig); const send = useServerFn(sendCleanerPayout); const check = useServerFn(checkCleanerPayout);
  const config = useQuery({ queryKey: ["payout-config"], queryFn: () => getConfig() });
  const account = useQuery({ queryKey: ["payout-account", cleanerId], enabled: admin, queryFn: async () => {
    const { data, error } = await supabase.from("cleaner_payout_accounts").select("paypal_email").eq("user_id", cleanerId).maybeSingle(); if (error) throw error; return data;
  } });
  const transfer = useQuery({ queryKey: ["payout-transfer", workId], refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from("cleaner_payouts").select("*").eq("work_id", workId).maybeSingle(); if (error) throw error; return data;
  } });
  const action = useMutation({ mutationFn: async (sending: boolean) => {
    if (sending) {
      if (!account.data?.paypal_email) throw new Error("Cleaner receiving account is missing.");
      return send({ data: { workId, recipient: account.data.paypal_email, amountCents: amount, confirmed: true } });
    }
    if (!transfer.data) throw new Error("No transfer found.");
    return check({ data: { id: transfer.data.id } });
  }, onSuccess: async result => { setMessage(result.message); setOpen(false); await Promise.all([qc.invalidateQueries({ queryKey: ["payout-transfer"] }), qc.invalidateQueries({ queryKey: ["payout-dashboard"], refetchType: "all" }), qc.invalidateQueries({ queryKey: ["timesheets"], refetchType: "all" })]); } });
  const transferId = transfer.data?.id;
  const pendingReceipt = Boolean(transfer.data?.paypal_batch_id && transfer.data.status === "pending");
  useEffect(() => {
    if (!transferId || !pendingReceipt) return;
    let cancelled = false;
    let checking = false;
    const reconcile = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await check({ data: { id: transferId } });
        if (cancelled) return;
        setMessage(result.message);
        await Promise.all([qc.invalidateQueries({ queryKey: ["payout-transfer"] }), qc.invalidateQueries({ queryKey: ["payout-dashboard"], refetchType: "all" }), qc.invalidateQueries({ queryKey: ["timesheets"], refetchType: "all" })]);
      } catch { /* Keep pending visible; receipt checks never send money. */ }
      finally { checking = false; }
    };
    void reconcile();
    const timer = setInterval(() => void reconcile(), 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [transferId, pendingReceipt, check, qc]);
  return <div className="mt-4">
    {transfer.data ? <div><p className="text-sm text-muted-foreground">PayPal · {transfer.data.environment === "live" ? "Live" : "Test"} · {transfer.data.provider_status ?? transfer.data.status}</p>
      {transfer.data.error_message && <p className="mt-1 text-sm text-destructive">{transfer.data.error_message}</p>}
      <Button className="mt-2" variant="outline" disabled={action.isPending} onClick={() => action.mutate(false)}><RefreshCw />Check transfer status</Button></div>
      : admin && <><Button disabled={action.isPending || transfer.isLoading || transfer.isError || !config.data?.configured || !account.data?.paypal_email} onClick={() => setOpen(true)}><Banknote />Pay with PayPal</Button>
        {account.isSuccess && !account.data && <p className="mt-2 text-sm text-muted-foreground">Cleaner receiving email is not set.</p>}</>}
    {(action.error || transfer.error || config.error || account.error) && <p role="alert" className="mt-2 text-destructive">{(action.error ?? transfer.error ?? config.error ?? account.error)?.message}</p>}
    {message && <p role="status" className="mt-2 text-primary">{message}</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Confirm cleaner payment</DialogTitle><DialogDescription>{config.data?.environment === "live" ? "This transfers real money from your PayPal business balance. PayPal fees may apply." : "This is a test transfer. No real money will move."}</DialogDescription></DialogHeader>
      <p className="text-2xl font-bold">${(amount / 100).toFixed(2)} USD</p><p className="break-all text-sm">To {account.data?.paypal_email}</p>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={action.isPending} onClick={() => action.mutate(true)}><Banknote />{action.isPending ? "Sending…" : "Confirm transfer"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}