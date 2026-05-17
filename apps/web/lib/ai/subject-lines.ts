import { generateObject } from "ai";
import { z } from "zod";
import { google } from "./client";

// Three subject-line candidates with a one-line rationale each.
// The rationale exists so the operator can compare like-with-like
// ("this one teases curiosity vs this one names the topic")
// instead of staring at three lines and guessing which to pick —
// which is exactly the friction that makes Sunday-night publishing
// stall on the subject field.
export const SubjectLineSchema = z.object({
  text: z
    .string()
    .min(8, "Subject too short")
    .max(85, "Subject too long for most inboxes"),
  rationale: z.string().min(8).max(120),
  style: z.enum(["topical", "curiosity", "punchy"]),
});

export const SubjectLinesOutputSchema = z.object({
  options: z.array(SubjectLineSchema).length(3),
});

export type SubjectLine = z.infer<typeof SubjectLineSchema>;
export type SubjectLinesOutput = z.infer<typeof SubjectLinesOutputSchema>;

const SUBJECT_LINES_PROMPT = `You are writing 3 subject-line options for a weekly community newsletter from {{COMMUNITY_NAME}}.

Inbox subject-line rules:
- 40–60 characters is the inbox sweet spot. Hard cap at 85.
- No emojis. No ALL CAPS. No clickbait.
- Avoid "Newsletter:", "Weekly digest:", "This week in...", "Issue #" — they shout "marketing" and inbox filters hate them.
- Prefer specific over generic. "Members rebuilt their deploy pipeline" beats "Community news."

Return exactly 3 options, each with a different angle:
1. style=topical    — names the most interesting thing that happened. Direct.
2. style=curiosity  — implies the interesting thing without naming it. Makes the reader open.
3. style=punchy     — short (under 35 chars), high-energy, single phrase.

Each option also gets a one-line "rationale" — explain in 8–20 words WHY this subject line is the best fit for the content. The rationale is shown to the operator next to the option so they can pick by intent, not by gut.

Here is the newsletter draft:

<newsletter>
{{NEWSLETTER}}
</newsletter>`;

// Pricing constants — keep in sync with pipeline.ts. We use Pass2's
// model (Pro) here because subject-line generation is a small but
// taste-driven task and the quality gap is more painful per-token
// than the cost gap.
const PRO_PRICING = { input: 1.25, output: 10.0 };

export interface SubjectLinesInput {
  communityName: string;
  newsletterMarkdown: string;
}

export interface SubjectLinesResult {
  options: SubjectLine[];
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
}

export async function runSubjectLines(
  input: SubjectLinesInput,
): Promise<SubjectLinesResult> {
  // Strip the story markers — they'd just confuse the model into
  // copying the slug text into a subject line.
  const cleaned = input.newsletterMarkdown.replace(/<!--\s*story:[^>]*-->\s*/g, "");
  const prompt = SUBJECT_LINES_PROMPT.replace(
    "{{COMMUNITY_NAME}}",
    input.communityName,
  ).replace("{{NEWSLETTER}}", cleaned);

  const result = await generateObject({
    model: google(process.env.AI_MODEL_PASS2 ?? "gemini-2.5-pro"),
    schema: SubjectLinesOutputSchema,
    prompt,
  });

  const tokensIn = result.usage.inputTokens ?? 0;
  const tokensOut = result.usage.outputTokens ?? 0;
  const costUsd =
    (tokensIn / 1_000_000) * PRO_PRICING.input +
    (tokensOut / 1_000_000) * PRO_PRICING.output;

  return { options: result.object.options, costUsd, tokensIn, tokensOut };
}
