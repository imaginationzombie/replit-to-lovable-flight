export type IncomeWork = { id: string; cleaner_id: string; amount_cents: number; status: string; paid_at: string | null };
export type IncomeTip = { cleaner_id: string; amount_cents: number; status: string; environment: string; customer_confirmed_at: string | null; payout_status: string; payout_paid_at: string | null; paypal_item_id: string | null };
export function housekeeperIncome(cleaners: { id: string; full_name: string }[], work: IncomeWork[], tips: IncomeTip[], completed: { cleaner_id: string | null }[], payouts: { work_id: string; environment: string; status: string; provider_status: string | null; paypal_item_id: string | null }[]) {
 return cleaners.map(cleaner => {
  const earnings = work.filter(w => w.cleaner_id === cleaner.id && ["submitted", "approved", "paid"].includes(w.status));
  const confirmed = tips.filter(t => t.cleaner_id === cleaner.id && t.status === "paid" && t.environment === "live" && t.customer_confirmed_at);
  const wages = earnings.reduce((sum, w) => sum + w.amount_cents, 0);
  const confirmedTips = confirmed.reduce((sum, t) => sum + t.amount_cents, 0);
  const settledWages = earnings.filter(w => w.status === "paid" && w.paid_at && payouts.some(p => p.work_id === w.id && p.environment === "live" && p.status === "paid" && p.provider_status === "SUCCESS" && p.paypal_item_id)).reduce((sum, w) => sum + w.amount_cents, 0);
  const settledTips = confirmed.filter(t => t.payout_status === "paid" && t.payout_paid_at && t.paypal_item_id).reduce((sum,t) => sum + t.amount_cents, 0);
  return { ...cleaner, wages, confirmedTips, total: wages + confirmedTips, settledWages, settledTips, settledTotal: settledWages + settledTips, completed: completed.filter(b => b.cleaner_id === cleaner.id).length };
 });
}