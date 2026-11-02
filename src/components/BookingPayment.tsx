import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PayBalance } from "@/components/PayBalance";
import { canPayBooking } from "@/lib/booking-payment";
import type { BookingRow } from "@/components/BookingCard";

export function BookingPayment({ booking }: { booking: BookingRow }) {
  const [open, setOpen] = useState(false);
  if (!canPayBooking(booking) || !booking.access_token) return null;
  const amount = `$${(booking.amount_cents / 100).toFixed(2)}`;
  return <>
    <Button onClick={() => setOpen(true)}><CreditCard />Pay {amount} with PayPal</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogTitle>Pay for your cleaning</DialogTitle>
      <DialogDescription>{booking.service} · {booking.preferred_date} · {amount}</DialogDescription>
      <PayBalance id={booking.id} token={booking.access_token} onPaid={() => setOpen(false)} />
    </DialogContent></Dialog>
  </>;
}