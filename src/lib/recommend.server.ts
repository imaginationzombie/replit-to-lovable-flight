import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function createRunIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get(RUN_ID_HEADER)?.trim() || undefined;
    return res;
  };
}

export const SERVICES = [
  "Standard Housekeeping",
  "Deep Clean",
  "Move-In / Move-Out Turnover",
  "Commercial Office",
  "Fall & Seasonal Property Care",
] as const;

export const recommendationSchema = z.object({
  service: z.enum(SERVICES),
  reason: z.string(),
  frequency: z.enum(["One-time", "Weekly", "Bi-weekly", "Monthly"]),
  bedrooms: z.number(),
  bathrooms: z.number(),
  addOns: z.array(z.string()),
  crewSize: z.number(),
  estimatedHours: z.number(),
  preferredDay: z.string(),
  preferredTimeWindow: z.string(),
  serviceArea: z.string().nullable(),
  specialNotes: z.string(),
  questionsForCustomer: z.array(z.string()),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

const INSTRUCTIONS = `You are the booking assistant for HousekeeperBooking.com, a home cleaning company in Central Pennsylvania (DuBois, Brookville, Punxsutawney, Reynoldsville, Sykesville, Falls Creek, Brockway).
Read the customer's description of their home, cleaning needs and schedule, then recommend exactly one service and prepare booking details.
Services: ${SERVICES.join(", ")}.
Available add-ons: Inside Oven, Inside Refrigerator, Baseboards, Interior Windows, Patio Sweep, Laundry Fold, Pet Hair Treatment.
Infer bedrooms/bathrooms if stated, else give your best guess (minimum 1). Crew size 1-4. Estimated hours realistic (1-10).
Use plain, friendly language. Keep "reason" to 1-2 sentences. List at most 3 short questionsForCustomer for anything important that is missing. Never invent prices.`;

export class RecommendError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function recommendService(description: string): Promise<Recommendation> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new RecommendError("AI is not configured.", 401);

  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createRunIdFetch(),
  });

  let failure: unknown;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions: INSTRUCTIONS,
    messages: [{ role: "user", content: description }],
    output: Output.object({ schema: recommendationSchema }),
    maxRetries: 0,
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  try {
    return await result.output;
  } catch (error) {
    const err = (failure ?? error) as { statusCode?: number; message?: string };
    console.error("recommendService failed", err);
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new RecommendError("We couldn't prepare a recommendation. Please add a bit more detail.", 422);
    }
    const status = err?.statusCode ?? 500;
    if (status === 402) throw new RecommendError("AI credits have run out. Please try again later.", 402);
    if (status === 429) throw new RecommendError("Too many requests right now. Please wait a moment and try again.", 429);
    if (status === 403) throw new RecommendError("The AI service declined this request.", 403);
    throw new RecommendError("The assistant is unavailable right now. Please try again.", status);
  }
}
