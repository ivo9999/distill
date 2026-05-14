import { generateText } from "ai";
import { google } from "./client";
import type { Story, Message } from "./pass1";

const PASS2_PROMPT = `You are writing a weekly newsletter for {{COMMUNITY_NAME}}. Your job is to turn this week's top community moments into a draft the community owner can edit and publish.

VOICE: Conversational, warm, slightly nerdy. Address the reader as "you." First-person plural ("we") when referring to the community. Never use the phrases "in this article", "let's dive in", "without further ado", "in conclusion", "game-changer", or any LinkedIn-flavored language. If you find yourself writing those, stop and rewrite.

STRUCTURE:
1. A 1–2 sentence hook at the top that captures the energy of the week. No heading on the hook.
2. 3–5 sections, each with a punchy heading (## level) and 80–150 words of body.
3. Each section paraphrases the conversation in your own words. Members are anonymized as "one member", "a regular", "someone in #general", unless I tell you to attribute.
4. Include direct links where members shared resources (use markdown link syntax).
5. Close with a single italic line: *What to watch next week: ...*

HARD RULES:
- Never invent facts, opinions, or quotes that weren't in the source messages.
- Never use anyone's real Discord username or display name.
- Never write more than 600 words total.
- If a story is thin or boring, cut it. Better 3 strong sections than 5 weak ones.
- Markdown output, ready to paste. No code fences around the whole output.
- Do not include a title at the top — the publishing platform handles that.

Here are this week's top stories with full message context:
{{TOP_STORIES_WITH_MESSAGES}}`;

export interface StoryWithMessages extends Story {
  messages: Message[];
}

export async function runPass2(
  stories: StoryWithMessages[],
  communityName: string
): Promise<{ markdown: string; tokensIn: number; tokensOut: number }> {
  const prompt = PASS2_PROMPT
    .replace("{{COMMUNITY_NAME}}", communityName)
    .replace(
      "{{TOP_STORIES_WITH_MESSAGES}}",
      JSON.stringify(stories, null, 2)
    );

  const result = await generateText({
    model: google(process.env.AI_MODEL_PASS2 ?? "gemini-2.5-pro"),
    prompt,
  });

  return {
    markdown: result.text,
    tokensIn: result.usage.inputTokens ?? 0,
    tokensOut: result.usage.outputTokens ?? 0,
  };
}
