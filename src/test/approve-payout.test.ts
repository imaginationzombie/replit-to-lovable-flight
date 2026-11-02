import { expect, it, vi } from "vitest";
import { approveAndTransfer } from "../lib/approve-payout";

it("starts the payout automatically after successful approval", async () => {
  const events: string[] = [];
  await approveAndTransfer({ approve: async () => { events.push("approved"); }, transfer: async () => { events.push("transfer"); return "Pending"; } });
  expect(events).toEqual(["approved", "transfer"]);
});
it("does not transfer when approval fails", async () => {
  const transfer = vi.fn();
  await expect(approveAndTransfer({ approve: async () => { throw new Error("Forbidden"); }, transfer })).rejects.toThrow("Forbidden");
  expect(transfer).not.toHaveBeenCalled();
});
it("never claims settlement or retries an uncertain transfer", async () => {
  const transfer = vi.fn().mockRejectedValue(new Error("Unknown PayPal result"));
  const result = await approveAndTransfer({ approve: async () => {}, transfer });
  expect(result.message).toContain("payment needs checking");
  expect(transfer).toHaveBeenCalledTimes(1);
});