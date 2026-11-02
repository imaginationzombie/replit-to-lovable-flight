import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";
export function PayoutAccount({ userId }: { userId: string }) {
  const qc = useQueryClient(); const [email, setEmail] = useState("");
  const account = useQuery({ queryKey: ["payout-account", userId], queryFn: async () => {
    const { data, error } = await supabase.from("cleaner_payout_accounts").select("paypal_email").eq("user_id", userId).maybeSingle(); if (error) throw error; return data;
  } });
  useEffect(() => { setEmail(account.data?.paypal_email ?? ""); }, [account.data]);
  const save = useMutation({ mutationFn: async () => {
    const { error } = await supabase.from("cleaner_payout_accounts").upsert({ user_id: userId, paypal_email: email.trim().toLowerCase() }); if (error) throw error;
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ["payout-account"] }) });
  return <section className="mt-6 border-y border-border py-5"><h2 className="font-bold">PayPal receiving account</h2>
    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <label className="min-w-0 flex-1 text-sm font-semibold">PayPal email<Input aria-label="PayPal receiving email" className="mt-1" type="email" required maxLength={254} disabled={account.isLoading} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <Button type="submit" disabled={save.isPending || account.isLoading}><Save />Save receiving account</Button>
    </form>
    {(save.error || account.error) && <p role="alert" className="mt-2 text-destructive">{(save.error ?? account.error)?.message}</p>}
    {save.isSuccess && <p role="status" className="mt-2 text-primary">Receiving account saved.</p>}
  </section>;
}