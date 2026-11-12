import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendBookingConfirmation } from "@/lib/confirmation.functions";

export function SendConfirmation({ bookingId, status }: { bookingId: string; status: string }) {
  const send = useServerFn(sendBookingConfirmation);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ sent: boolean; message: string } | null>(null);
  async function submit() {
    setPending(true);
    try { setResult(await send({ data: { bookingId } })); }
    catch { setResult({ sent: false, message: "Email wasn’t sent. Please try again." }); }
    finally { setPending(false); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    <Button type="button" variant="outline" size="sm" disabled={pending || status !== "confirmed" || result?.sent} title={status !== "confirmed" ? "Confirm the visit before sending" : "Send confirmation to customer and assigned housekeeper"} onClick={submit}><Mail />{pending ? "Sending…" : result?.sent ? "Confirmations sent" : "Send confirmation"}</Button>
    {result && <p role={result.sent ? "status" : "alert"} className={`max-w-80 text-xs ${result.sent ? "text-primary" : "text-destructive"}`}>{result.message}</p>}
  </div>;
}