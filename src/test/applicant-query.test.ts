import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { myApplicationOptions } from "../lib/people-portals";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ order: mocks.order });
});

it("requests only the signed-in applicant's records, including for staff accounts", async () => {
  const rows = [{ id: "application-1", user_id: "applicant-1", status: "reviewing" }];
  mocks.order.mockResolvedValue({ data: rows, error: null });
  const options = myApplicationOptions("applicant-1");
  const query = options.queryFn;
  if (typeof query !== "function") throw new Error("Missing applicant query");
  const result = await query({ queryKey: options.queryKey, signal: new AbortController().signal, client: {} as never, meta: undefined });
  expect(mocks.from).toHaveBeenCalledWith("hiring_applications");
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "applicant-1");
  expect(result).toEqual(rows);
  expect(myApplicationOptions("applicant-2").queryKey).not.toEqual(options.queryKey);
});

it("does not report an empty hiring history when the saved application cannot be read", async () => {
  mocks.order.mockResolvedValue({ data: null, error: new Error("Access denied") });
  const options = myApplicationOptions("applicant-1");
  const query = options.queryFn;
  if (typeof query !== "function") throw new Error("Missing applicant query");
  await expect(query({ queryKey: options.queryKey, signal: new AbortController().signal, client: {} as never, meta: undefined })).rejects.toThrow("Access denied");
});