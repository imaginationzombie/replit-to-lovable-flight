import { beforeEach, expect, it, vi } from "vitest";

const { from, reads } = vi.hoisted(() => ({ from: vi.fn(), reads: [] as { table: string; filters: [string, string][] }[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { cleanerIncomeOptions } from "../lib/cleaner-dashboard-query";

beforeEach(() => {
  reads.length = 0;
  from.mockImplementation((table: string) => {
    const filters: [string, string][] = [];
    reads.push({ table, filters });
    const builder = {
      select: () => builder,
      eq: (column: string, value: string) => { filters.push([column, value]); return builder; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return builder;
  });
});

it("scopes every dashboard income read to the signed-in cleaner", async () => {
  const options = cleanerIncomeOptions("cleaner-1");
  if (typeof options.queryFn !== "function") throw new Error("Missing query function");
  const result = await options.queryFn({} as never);
  expect(reads.map(r => r.table)).toEqual(["appointment_work", "booking_tips", "bookings", "cleaner_payouts"]);
  for (const read of reads) expect(read.filters).toContainEqual(["cleaner_id", "cleaner-1"]);
  expect(reads.find(r => r.table === "bookings")?.filters).toContainEqual(["status", "completed"]);
  expect(result).toMatchObject({ id: "cleaner-1", wages: 0, confirmedTips: 0, settledTotal: 0 });
});