import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Recommendation } from "./recommend.server";

const input = z.object({ description: z.string().trim().min(15).max(4000) });

export type RecommendResult =
  | { ok: true; recommendation: Recommendation }
  | { ok: false; error: string };

export const getRecommendation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<RecommendResult> => {
    const { recommendService, RecommendError } = await import("./recommend.server");
    try {
      return { ok: true, recommendation: await recommendService(data.description) };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof RecommendError ? e.message : "Something went wrong. Please try again.",
      };
    }
  });
