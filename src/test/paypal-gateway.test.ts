import { afterEach, expect, it, vi } from "vitest";
import { api, payoutsConfigured } from "../lib/payouts.server";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("routes live payouts through the connected PayPal service with the saved request key", async () => {
  vi.stubEnv("PAYPAL_API_KEY", "test-connection");
  vi.stubEnv("LOVABLE_API_KEY", "test-gateway");
  vi.stubEnv("PAYPAL_ENV", "live");
  const fetch = vi.fn().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetch);
  expect(payoutsConfigured()).toBe(true);
  await api("/v1/payments/payouts", "POST", { items: [] }, "live", "saved-transfer-key");
  expect(fetch).toHaveBeenCalledWith("https://connector-gateway.lovable.dev/paypal/v1/payments/payouts", expect.objectContaining({ headers: expect.objectContaining({ "PayPal-Request-Id": "saved-transfer-key" }) }));
});

it("does not send a historical test payout through a live connection", async () => {
  vi.stubEnv("PAYPAL_ENV", "live");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(api("/v1/payments/payouts", "POST", {}, "sandbox")).rejects.toThrow("different PayPal environment");
  expect(fetch).not.toHaveBeenCalled();
});