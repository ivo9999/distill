import { generateObject } from "ai";
import { z } from "zod";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { anthropic } from "./client";

const __dirname_resolved = typeof __dirname !== "undefined"
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

export const StorySchema = z.object({
  story_id: z.string(),
  type: z.enum(["win", "debate", "resource", "question", "hot_take", "moment"]),
  title: z.string(),
  why_it_matters: z.string(),
  engagement_signal: z.number().min(1).max(10),
  key_message_ids: z.array(z.string()),
  verbatim_snippets: z.array(z.string()).max(2),
});

export const Pass1OutputSchema = z.object({
  stories: z.array(StorySchema).min(3).max(15),
});

export type Story = z.infer<typeof StorySchema>;
export type Pass1Output = z.infer<typeof Pass1OutputSchema>;

const promptTemplate = readFileSync(
  join(__dirname_resolved, "prompts", "pass1.txt"),
  "utf-8"
);

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
  const prompt = promptTemplate
    .replace("{{COMMUNITY_TYPE}}", communityType)
    .replace("{{MESSAGES_JSON}}", JSON.stringify(messages, null, 2));

  const result = await generateObject({
    model: anthropic(process.env.AI_MODEL_PASS1!),
    schema: Pass1OutputSchema,
    prompt,
  });

  return {
    output: result.object,
    tokensIn: result.usage.promptTokens,
    tokensOut: result.usage.completionTokens,
  };
}
