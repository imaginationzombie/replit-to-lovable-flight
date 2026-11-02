import type { ReactNode } from "react";

export type BookingRow = {
  id: string; status: string; customer_name: string; email: string; phone: string; address: string;
  service_area: string; service: string; frequency: string; bedrooms: number; bathrooms: number;
  add_ons: string[]; rush: boolean; preferred_date: string; time_window: string; notes: string;
  amount_cents: number; cleaner_id: string | null; created_at: string;
  paid_at?: string | null; access_token?: string;
};

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function BookingCard({ b, showCustomer, children }: { b: BookingRow; showCustomer?: boolean; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-foreground">{b.service} <span className="font-normal text-muted-foreground">• {b.frequency}</span></p>
          <p className="text-sm text-muted-foreground">{fmtDate(b.preferred_date)} • {b.time_window}</p>
        </div>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{STATUS_LABEL[b.status] ?? b.status}</span>
      </div>
      <p className="mt-2 text-sm text-foreground">{b.bedrooms} bed / {b.bathrooms} bath • {b.address} ({b.service_area})</p>
      {b.add_ons.length > 0 && <p className="text-sm text-muted-foreground">Add-ons: {b.add_ons.join(", ")}{b.rush ? ", Rush" : ""}</p>}
      {showCustomer && <p className="mt-1 text-sm text-foreground"><strong>{b.customer_name}</strong> • {b.phone} • {b.email}</p>}
      {b.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">Notes: {b.notes}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-bold text-primary">${(b.amount_cents / 100).toFixed(2)}
          <span className="ml-2 text-xs font-semibold text-muted-foreground">{b.paid_at ? "Paid" : b.status === "completed" ? "Payment due" : b.status === "confirmed" ? "Charged after cleaning" : ""}</span>
          {b.status === "completed" && !b.paid_at && b.access_token && !showCustomer && (
            <a href={`/booking/${b.id}?t=${b.access_token}`} className="ml-3 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Pay now</a>
          )}
        </span>
        {children}
      </div>
    </div>
  );
}
