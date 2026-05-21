import { generateText } from "ai";
import { modelFor } from "./client";
import type { Story, Message } from "./pass1";

const PASS2_PROMPT = `You are writing a weekly newsletter for {{COMMUNITY_NAME}}. Your job is to turn this week's top community moments into a draft the community owner can edit and publish.

{{VOICE_ANCHOR}}

VOICE: Conversational, warm, slightly nerdy. Address the reader as "you." First-person plural ("we") when referring to the community. Never use the phrases "in this article", "let's dive in", "without further ado", "in conclusion", "game-changer", or any LinkedIn-flavored language. If you find yourself writing those, stop and rewrite.

STRUCTURE:
1. A 1–2 sentence hook at the top that captures the energy of the week. No heading on the hook.
2. One section per story (## level heading + 80–150 words of body). If you got 1 story, write 1 section. If you got 5, write 5. Do not invent extra sections to hit a count.
3. IMPORTANT — IMMEDIATELY BEFORE each ## heading, emit an HTML comment with the story_id you're writing about, like this:
   <!-- story:story_id_here -->
   ## Heading
   These markers are stripped in the rendered email but let the dashboard show readers which Discord messages each section came from. Use exactly one marker per section, referencing the story_id from the input. Never invent story_ids; never share a marker between sections.
4. Each section paraphrases the conversation in your own words. Members are anonymized as "one member", "a regular", "someone in #general", unless I tell you to attribute.
5. Include direct links where members shared resources (use markdown link syntax).
6. Close with a single italic line: *What to watch next week: ...*

HARD RULES:
- Never invent facts, opinions, or quotes that weren't in the source messages.
- Never use anyone's real Discord username or display name.
- Never write more than 600 words total.
- If a story is thin or boring, cut it. Better 1 strong section than 5 weak ones — a short honest email beats a padded one.
- A 1-story week is fine. The hook becomes "Quiet week, one thing worth telling." Then the section. Then the closing line. That's a complete draft.
- Markdown output, ready to paste. No code fences around the whole output.
- Do not include a title at the top — the publishing platform handles that.

Here are this week's top stories with full message context:
{{TOP_STORIES_WITH_MESSAGES}}`;

export interface StoryWithMessages extends Story {
  messages: Message[];
}

export async function runPass2(
  stories: StoryWithMessages[],
  communityName: string,
  voiceSample?: string,
): Promise<{ markdown: string; tokensIn: number; tokensOut: number }> {
  // VOICE_ANCHOR — if the operator has pasted a past newsletter as a
  // style exemplar, surface it as an explicit anchor BEFORE the
  // general VOICE rules. Models copy tone, rhythm, and idiom from
  // concrete examples far more reliably than from abstract
  // descriptors. Cap to ~5000 chars so a long sample doesn't dominate
  // the prompt budget or push token cost up materially. The "anchor
  // wins on tone, hard rules still apply" language is load-bearing —
  // without it the model will sometimes adopt a sample's bad habits
  // (e.g. exclamation overuse) AND drop the anti-hallucination rules.
  const voiceAnchor =
    voiceSample && voiceSample.trim().length > 50
      ? `VOICE ANCHOR — the operator pasted this past newsletter as a tone example. Match its rhythm, sentence length, idiom, and warmth. Do NOT copy phrases or specific facts; only the voice. If it conflicts with the VOICE rules below, the anchor wins on tone but the hard rules below still apply.\n\n<example>\n${voiceSample.slice(0, 5000)}\n</example>`
      : "";

  // Strip fields the drafter doesn't need (discordChannelId is for
  // the editor's permalink-builder only; weighted_signal /
  // channelWeight are internal ranking inputs the drafter would just
  // pattern-match into the output if shown).
  const storiesForPrompt = stories.map((s) => {
    const messages = s.messages.map(({ discordChannelId: _u1, channelWeight: _u2, ...rest }) => rest);
    return {
      story_id: s.story_id,
      type: s.type,
      title: s.title,
      why_it_matters: s.why_it_matters,
      key_message_ids: s.key_message_ids,
      verbatim_snippets: s.verbatim_snippets,
      messages,
    };
  });

  const prompt = PASS2_PROMPT
    .replace("{{COMMUNITY_NAME}}", communityName)
    .replace("{{VOICE_ANCHOR}}", voiceAnchor)
    .replace(
      "{{TOP_STORIES_WITH_MESSAGES}}",
      JSON.stringify(storiesForPrompt, null, 2)
    );

  const result = await generateText({
    model: modelFor(process.env.AI_MODEL_PASS2 ?? "claude-haiku-4-5"),
    prompt,
  });

  return {
    markdown: result.text,
    tokensIn: result.usage.inputTokens ?? 0,
    tokensOut: result.usage.outputTokens ?? 0,
  };
}
