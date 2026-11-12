import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyGift } from "@/lib/gift-certificates.functions";
import { refreshBookingViews } from "@/lib/booking-sync";
export function GiftCredit({ id, token }: { id: string; token: string }) {
 const [code, setCode] = useState(""); const redeem = useServerFn(applyGift); const qc = useQueryClient(); const router = useRouter();
 const save = useMutation({ mutationFn: () => redeem({ data: { id, token, code: code.trim() } }), onSuccess: async () => { setCode(""); await refreshBookingViews(qc); await router.invalidate(); } });
 return <form className="mt-6 border-t border-border pt-5" onSubmit={e => { e.preventDefault(); save.mutate(); }}><label className="block text-sm font-semibold">Gift certificate code<input required value={code} onChange={e => setCode(e.target.value)} className="mt-2 w-full min-w-0 rounded-md border border-input bg-background p-3 text-foreground" /></label><Button className="mt-3" disabled={save.isPending}><Gift />{save.isPending ? "Applying…" : "Apply gift credit"}</Button>{save.error && <p role="alert" className="mt-2 text-sm text-destructive">{save.error.message}</p>}{save.data && <p role="status" className="mt-2 text-sm text-primary">${(save.data.appliedCents / 100).toFixed(2)} gift credit applied.</p>}</form>;
}