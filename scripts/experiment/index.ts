import { program } from "commander";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

// Import the shared pipeline module
import { runPipeline, type Message } from "../../apps/web/lib/ai/pipeline";

interface DiscordExportMessage {
  id: string;
  author: { id: string; name: string };
  content: string;
  timestamp: string;
  reactions?: Array<{ count: number }>;
  reference?: { messageId?: string };
}

function normalizeMessages(raw: DiscordExportMessage[]): Message[] {
  return raw.map((m) => ({
    id: m.id,
    authorId: m.author.id,
    authorName: m.author.name,
    content: m.content,
    timestamp: m.timestamp,
    reactionCount: m.reactions?.reduce((sum, r) => sum + r.count, 0) ?? 0,
    replyCount: 0,
    replyToId: m.reference?.messageId,
  }));
}

program
  .requiredOption("--input <path>", "Path to Discord export JSON")
  .requiredOption("--community-type <type>", "Community type description")
  .requiredOption("--output <path>", "Output markdown path")
  .parse();

const opts = program.opts();

async function main() {
  console.log("Reading input:", opts.input);
  const raw: DiscordExportMessage[] = JSON.parse(
    readFileSync(opts.input, "utf-8")
  );
  console.log(`Loaded ${raw.length} messages`);

  const messages = normalizeMessages(raw);

  console.log("Running pipeline...");
  const result = await runPipeline({
    communityType: opts.communityType,
    serverName: "Experiment",
    messages,
  });

  mkdirSync(dirname(opts.output), { recursive: true });
  writeFileSync(opts.output, result.markdown);

  console.log("\n--- Results ---");
  console.log(`Output written to: ${opts.output}`);
  console.log(`Pass 1: ${result.pass1TokensIn} in / ${result.pass1TokensOut} out`);
  console.log(`Pass 2: ${result.pass2TokensIn} in / ${result.pass2TokensOut} out`);
  console.log(`Estimated cost: $${result.costUsd.toFixed(4)}`);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
