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

export const Pass1OutputSchema = z.object({
  stories: z.array(StorySchema).min(3).max(15),
});

export type Story = z.infer<typeof StorySchema>;
export type Pass1Output = z.infer<typeof Pass1OutputSchema>;

const PASS1_PROMPT = `You are a community editor analyzing one week of Discord messages from {{COMMUNITY_TYPE}}.

Your job is to find the 10–15 conversations from this week that would make the best content for a weekly newsletter sent to people who are NOT in the Discord. The newsletter readers care about:
- Wins and launches by community members
- Substantive technical debates and "I learned X" moments
- Useful resources shared (links, tools, tips)
- Hot takes and opinions that sparked real discussion
- Questions that got great answers
- Anything funny, weird, or memorable

Ignore: greetings, off-topic chatter, single-message announcements with no engagement, support requests with no resolution, anything spam-adjacent, anything from a user in the opt-out list.

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

Return ONLY a valid JSON array of 10–15 stories ranked by engagement_signal descending. No prose before or after the JSON.

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
