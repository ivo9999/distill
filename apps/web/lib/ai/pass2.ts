import { generateText } from "ai";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { anthropic } from "./client";
import type { Story, Message } from "./pass1";

const __dirname_resolved = typeof __dirname !== "undefined"
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

const promptTemplate = readFileSync(
  join(__dirname_resolved, "prompts", "pass2.txt"),
  "utf-8"
);

export interface StoryWithMessages extends Story {
  messages: Message[];
}

export async function runPass2(
  stories: StoryWithMessages[],
  communityName: string
): Promise<{ markdown: string; tokensIn: number; tokensOut: number }> {
  const prompt = promptTemplate
    .replace("{{COMMUNITY_NAME}}", communityName)
    .replace(
      "{{TOP_STORIES_WITH_MESSAGES}}",
      JSON.stringify(stories, null, 2)
    );

  const result = await generateText({
    model: anthropic(process.env.AI_MODEL_PASS2!),
    prompt,
  });

  return {
    markdown: result.text,
    tokensIn: result.usage.promptTokens,
    tokensOut: result.usage.completionTokens,
  };
}
