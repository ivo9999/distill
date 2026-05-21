import { generateText } from "ai";
import { modelFor } from "./client";
import type { SourceSection } from "./pipeline";

// Pre-defined rewrite directives. Each maps to a short instruction
// the regenerator passes to the model. Keeping these in code rather
// than free-text means:
//   - the user sees a clear, deterministic menu (no "what do I type")
//   - we can tune the prompts without UI changes
//   - cheap directives (tighten / cut) can short-circuit to a cheaper
//     model later without changing the public API
//
// "rewrite_from_messages" intentionally throws away the current draft
// of the section and asks the model to start over from the source
// messages — the strongest correction available to the operator
// short of regenerating the whole newsletter.
export type RegenerateDirective =
  | "tighter"
  | "funnier"
  | "more_detail"
  | "rewrite_from_messages";

const DIRECTIVE_INSTRUCTIONS: Record<RegenerateDirective, string> = {
  tighter:
    "Make this section tighter and punchier. Cut filler. Same content, ~30% fewer words. Keep the existing heading and the existing markdown link syntax.",
  funnier:
    "Inject a single dry, observational line of humor — the kind a friend writing a newsletter would slip in, not a stand-up bit. Do not change facts. Keep the existing heading.",
  more_detail:
    "Expand this section by 30–50%. Pull more from the source messages — quotes, specifics, the actual outcome of the thread. Keep the existing heading.",
  rewrite_from_messages:
    "Discard the existing draft of this section and write a new one from scratch using ONLY the source messages provided. Same ## heading text. Keep the same paraphrase rules (anonymize members, no invented facts).",
};

const REGENERATE_PROMPT = `You are rewriting one section of a community newsletter for {{COMMUNITY_NAME}}. The rest of the newsletter stays as-is — your job is to produce ONLY the markdown for this one section (heading + body), nothing else.

DIRECTIVE: {{DIRECTIVE_INSTRUCTION}}

HARD RULES (these always apply, even when the directive conflicts):
- Never invent facts, opinions, or quotes that weren't in the source messages.
- Never use anyone's real Discord username or display name.
- Members are anonymized as "one member", "a regular", "someone in #general", unless told otherwise.
- Output ONLY the section markdown (## heading + body). No code fences. No preamble. No "Here is the rewritten section:".
- Keep the exact same ## heading text unless the directive explicitly asks you to change it.

CURRENT DRAFT OF THIS SECTION:
{{CURRENT_SECTION}}

SOURCE MESSAGES (the original Discord context this section came from):
{{SOURCE_MESSAGES}}`;

export interface RegenerateInput {
  communityName: string;
  directive: RegenerateDirective;
  currentSection: string;
  source: SourceSection;
}

export interface RegenerateOutput {
  markdown: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
}

// Gemini 2.5 Pro pricing — keep in sync with pipeline.ts. Hard-coded
// here too because this module runs independently of the main
// pipeline and the cost reporting matters for per-call accounting.
const PRO_PRICING = { input: 1.25, output: 10.0 };

export async function runRegenerateSection(
  input: RegenerateInput,
): Promise<RegenerateOutput> {
  const sourceMessagesText = input.source.messages
    .map(
      (m) =>
        `[${m.authorName}${m.channelName ? ` in #${m.channelName}` : ""}]\n${m.content}`,
    )
    .join("\n\n");

  const prompt = REGENERATE_PROMPT.replace("{{COMMUNITY_NAME}}", input.communityName)
    .replace(
      "{{DIRECTIVE_INSTRUCTION}}",
      DIRECTIVE_INSTRUCTIONS[input.directive],
    )
    .replace("{{CURRENT_SECTION}}", input.currentSection)
    .replace("{{SOURCE_MESSAGES}}", sourceMessagesText);

  const result = await generateText({
    model: modelFor(process.env.AI_MODEL_PASS2 ?? "claude-haiku-4-5"),
    prompt,
  });

  const tokensIn = result.usage.inputTokens ?? 0;
  const tokensOut = result.usage.outputTokens ?? 0;
  const costUsd =
    (tokensIn / 1_000_000) * PRO_PRICING.input +
    (tokensOut / 1_000_000) * PRO_PRICING.output;

  // Trim any accidental code-fence wrapper the model sometimes adds
  // despite the explicit rule. Strip a leading/trailing ``` line and
  // any "Here is..." preamble line.
  let md = result.text.trim();
  md = md.replace(/^```(?:markdown)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  md = md.replace(/^Here(?:'s| is) the rewritten section:?\s*\n?/i, "");

  return { markdown: md, costUsd, tokensIn, tokensOut };
}
