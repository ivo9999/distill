import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// modelFor routes a model id to its provider: claude-* ids go to
// Anthropic, everything else to Google. This keeps model selection a
// pure env-var concern — AI_MODEL_PASS1/PASS2 can name a model from
// either provider and the right client is chosen automatically.
export function modelFor(modelId: string): LanguageModel {
  if (modelId.startsWith("claude-")) {
    return anthropic(modelId);
  }
  return google(modelId);
}
