import { runPass1, type Message } from "./pass1";
import { runPass2, type StoryWithMessages } from "./pass2";

// Google Gemini pricing per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "gemini-2.5-pro": { input: 1.25, output: 10.00 },
};

function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = PRICING[model] ?? { input: 3.0, output: 15.0 };
  return (
    (tokensIn / 1_000_000) * pricing.input +
    (tokensOut / 1_000_000) * pricing.output
  );
}

export interface PipelineInput {
  communityType: string;
  serverName: string;
  messages: Message[];
  // Optional: a past newsletter the operator pasted as a style
  // exemplar. Pass2 uses it as a voice anchor; ignored if empty or
  // under 50 chars (anything shorter is too weak a signal).
  voiceSample?: string;
}

export interface PipelineOutput {
  markdown: string;
  costUsd: number;
  pass1TokensIn: number;
  pass1TokensOut: number;
  pass2TokensIn: number;
  pass2TokensOut: number;
  // Per-section source map. Each entry corresponds to one Pass2
  // section identified by its <!-- story:slug --> marker; the editor
  // uses this to show readers the Discord messages each section was
  // built from, which is the single most effective trust signal for
  // AI-written content ("the model didn't make this up — here's the
  // thread"). Stories that Pass2 dropped don't appear here, so this
  // list is a subset of Pass1's top-8.
  sources: SourceSection[];
}

export interface SourceSection {
  storyId: string;
  type: string;
  title: string;
  whyItMatters: string;
  // Discord-side IDs so the dashboard can build permalinks of the
  // form https://discord.com/channels/<guild>/<channel>/<message>.
  // We include the message body too so a non-admin reading the
  // dashboard sees the source content without leaving the page.
  messages: Array<{
    id: string;
    authorName: string;
    content: string;
    timestamp: string;
    channelName?: string;
    discordChannelId?: string;
  }>;
}

export async function runPipeline(
  input: PipelineInput
): Promise<PipelineOutput> {
  // Pass 1: Rank and identify stories
  const pass1 = await runPass1(input.messages, input.communityType);

  // Apply per-channel weights deterministically: scale each story's
  // engagement_signal by the max weight of its source messages. We use
  // max (not mean) so a single high-signal message can lift a story
  // even if it references context messages from a noisier channel.
  // The Pass1 prompt also gets the weights as a hint, but this step
  // is what actually changes the top-8 selection — we don't trust the
  // model to apply numeric weights reliably.
  const messageMap = new Map(input.messages.map((m) => [m.id, m]));
  const weighted = pass1.output.stories.map((story) => {
    let maxWeight = 1.0;
    for (const id of story.key_message_ids) {
      const m = messageMap.get(id);
      if (m?.channelWeight && m.channelWeight > maxWeight) {
        maxWeight = m.channelWeight;
      }
    }
    return {
      ...story,
      weighted_signal: story.engagement_signal * maxWeight,
    };
  });

  // Top 8 stories by weighted signal (descending)
  const topStories = weighted
    .sort((a, b) => b.weighted_signal - a.weighted_signal)
    .slice(0, 8);

  const storiesWithMessages: StoryWithMessages[] = topStories.map((story) => ({
    ...story,
    messages: story.key_message_ids
      .map((id) => messageMap.get(id))
      .filter((m): m is Message => m !== undefined),
  }));

  // Pass 2: Draft newsletter
  const pass2 = await runPass2(storiesWithMessages, input.serverName, input.voiceSample);

  const model1 = process.env.AI_MODEL_PASS1 ?? "gemini-2.5-flash";
  const model2 = process.env.AI_MODEL_PASS2 ?? "gemini-2.5-pro";

  const costUsd =
    calculateCost(model1, pass1.tokensIn, pass1.tokensOut) +
    calculateCost(model2, pass2.tokensIn, pass2.tokensOut);

  // Build the source-map: walk Pass2's markdown for the per-section
  // story markers in order, and join each one back to its Pass1
  // story + source messages. Sections Pass2 dropped (the editor cut
  // a thin story) don't appear; markers referencing unknown story_ids
  // are skipped silently — the only consequence is that section has
  // no "view sources" affordance, which beats throwing the whole
  // generation away over a model formatting hiccup.
  const storyById = new Map(storiesWithMessages.map((s) => [s.story_id, s]));
  const markerRegex = /<!--\s*story:([A-Za-z0-9_-]+)\s*-->/g;
  const sources: SourceSection[] = [];
  const seenInOutput = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = markerRegex.exec(pass2.markdown)) !== null) {
    const id = match[1].trim();
    if (seenInOutput.has(id)) continue;
    seenInOutput.add(id);
    const story = storyById.get(id);
    if (!story) continue;
    sources.push({
      storyId: story.story_id,
      type: story.type,
      title: story.title,
      whyItMatters: story.why_it_matters,
      messages: story.messages.map((m) => ({
        id: m.id,
        authorName: m.authorName,
        content: m.content,
        timestamp: m.timestamp,
        channelName: m.channelName,
        discordChannelId: m.discordChannelId,
      })),
    });
  }

  return {
    markdown: pass2.markdown,
    costUsd,
    pass1TokensIn: pass1.tokensIn,
    pass1TokensOut: pass1.tokensOut,
    pass2TokensIn: pass2.tokensIn,
    pass2TokensOut: pass2.tokensOut,
    sources,
  };
}

export type { Message } from "./pass1";
