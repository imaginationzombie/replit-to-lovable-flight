export function payoutOutcome(status?: string) {
  if (status === "SUCCESS") return "paid";
  if (["FAILED", "DENIED", "BLOCKED", "RETURNED", "REFUNDED", "CANCELED"].includes(status ?? "")) return "failed";
  return "pending";
}
export function payoutValue(cents: number) {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Approved earnings must be greater than zero.");
  return (cents / 100).toFixed(2);
}