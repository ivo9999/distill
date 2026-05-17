import { generateObject } from "ai";
import { z } from "zod";
import { google } from "./client";

export const StorySchema = z.object({
  story_id: z.string(),
  type: z.enum(["win", "debate", "resource", "question", "hot_take", "moment"]),
  title: z.string(),
  why_it_matters: z.string(),
  engagement_signal: z.number().min(1).max(10),
  key_message_ids: z.array(z.string()),
  verbatim_snippets: z.array(z.string()).max(5),
});

// Floor is 1 deliberately. The PRD's original min(3) was an editorial
// ideal — a great week should have 3+ stories — but it doubled as a
// schema floor, which on thin weeks made the whole generation fail
// loudly when Gemini honestly returned 1-2 stories. The marketing
// promise is "a slow week produces a short, honest email — 'here's the
// one good thread, see you next week'", so the schema should match the
// promise. Pass-2's prompt does the editorial cutting from there.
export const Pass1OutputSchema = z.object({
  stories: z.array(StorySchema).min(1).max(15),
});

export type Story = z.infer<typeof StorySchema>;
export type Pass1Output = z.infer<typeof Pass1OutputSchema>;

const PASS1_PROMPT = `You are a community editor analyzing one week of Discord messages from {{COMMUNITY_TYPE}}.

Your job is to find every conversation from this week that would make good content for a weekly newsletter sent to people who are NOT in the Discord. A great week might have 10+; a quiet week might have 1-2; both are fine. Do NOT invent stories or pad the list — readers can tell. The newsletter readers care about:
- Wins and launches by community members
- Substantive technical debates and "I learned X" moments
- Useful resources shared (links, tools, tips)
- Hot takes and opinions that sparked real discussion
- Questions that got great answers
- Anything funny, weird, or memorable

Ignore: greetings, off-topic chatter, single-message announcements with no engagement, support requests with no resolution, anything spam-adjacent, anything from a user in the opt-out list.

Each message may carry a "channelWeight" field. The operator marked some channels as high-signal (weight > 1.0) and others as low-signal (weight < 1.0). Treat high-signal channels as more likely sources of newsletter-worthy stories, and low-signal channels as background noise unless something individually exceptional happens there.

For each story candidate, return:
{
  "story_id": "short-slug",
  "type": "win|debate|resource|question|hot_take|moment",
  "title": "one-line description of what happened",
  "why_it_matters": "one sentence on why a newsletter reader would care",
  "engagement_signal": <number 1-10 based on reactions, replies, thread depth>,
  "key_message_ids": ["id1", "id2", ...],
  "verbatim_snippets": ["short direct quotes if essential, max 1-2 per story, max 15 words each"]
}

Return ONLY a JSON object with a "stories" array, sorted by engagement_signal descending. Include only stories that genuinely happened — if the week was thin, return 1 or 2, not a forced 10. The drafter downstream will write what you give it; padding becomes obvious filler.

Here are this week's messages:
{{MESSAGES_JSON}}`;

export interface Message {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: string;
  reactionCount: number;
  replyCount: number;
  replyToId?: string;
  threadId?: string;
  channelName?: string;
  // Per-channel weight (0.5 / 1.0 / 2.0 nominally). The user marks
  // some channels as high-signal (#wins, #showcase) and others as
  // low (#general, #off-topic) in the dashboard. The pipeline applies
  // this post-Pass1 by scaling engagement_signal; the Pass1 prompt
  // also surfaces it as a soft hint so the model gets a chance to
  // prefer stronger channels at selection time too.
  channelWeight?: number;
}

export async function runPass1(
  messages: Message[],
  communityType: string
): Promise<{ output: Pass1Output; tokensIn: number; tokensOut: number }> {
  const prompt = PASS1_PROMPT
    .replace("{{COMMUNITY_TYPE}}", communityType)
    .replace("{{MESSAGES_JSON}}", JSON.stringify(messages, null, 2));

  const result = await generateObject({
    model: google(process.env.AI_MODEL_PASS1 ?? "gemini-2.5-flash"),
    schema: Pass1OutputSchema,
    prompt,
  });

  return {
    output: result.object,
    tokensIn: result.usage.inputTokens ?? 0,
    tokensOut: result.usage.outputTokens ?? 0,
  };
}
