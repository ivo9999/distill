import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { runPipeline, type Message } from "@/lib/ai/pipeline";

export const maxDuration = 120;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // 1. Check on-demand generation quota
  const quotaRes = await goFetch(`/api/servers/${id}/generation-quota`);
  if (!quotaRes.ok) {
    return NextResponse.json({ error: "failed to check quota" }, { status: 500 });
  }
  const quota = await quotaRes.json();
  if (quota.remaining <= 0) {
    const msg =
      quota.tier === "free"
        ? "You've used your free generation for this server. Subscribe to keep going."
        : `You've used all ${quota.limit} on-demand generations this month (${quota.tier} plan).`;
    return NextResponse.json(
      { error: msg, tier: quota.tier, category: "quota" },
      { status: 402 },
    );
  }

  // 2. Get server info
  const serverRes = await goFetch(`/api/servers/${id}`);
  if (!serverRes.ok) {
    return NextResponse.json({ error: "server not found" }, { status: 404 });
  }
  const server = await serverRes.json();

  // 3. Get messages from DB (last 7 days, respects opt-outs)
  const messagesRes = await goFetch(`/api/servers/${id}/messages`);
  if (!messagesRes.ok) {
    return NextResponse.json({ error: "failed to fetch messages" }, { status: 500 });
  }
  const dbMessages = await messagesRes.json();

  if (!Array.isArray(dbMessages) || dbMessages.length === 0) {
    // Surfaced as a "thin_week" category so the UI shows the friendly
    // "add more channels" UX rather than a red error banner. Same root
    // cause as Pass1 returning [] — the channels were silent — same
    // recovery action.
    return NextResponse.json(
      {
        error:
          "No messages from your monitored channels this past week. Try adding more channels, or wait for more activity.",
        category: "thin_week",
      },
      { status: 400 },
    );
  }

  // 4. Map DB messages to pipeline format
  const allMessages: Message[] = dbMessages.map((m: any) => ({
    id: m.id,
    authorId: m.author_id,
    authorName: m.author_name,
    content: m.content,
    timestamp: m.timestamp,
    reactionCount: m.reaction_count,
    replyCount: m.reply_count,
    replyToId: m.reply_to_id || undefined,
    threadId: m.thread_id || undefined,
    channelName: m.channel_name,
  }));

  // 5. Run the AI pipeline.
  //
  // Wrapped so schema-validation / timeout / model-rate-limit errors
  // become structured user-facing messages instead of bubbling up as
  // a generic 500. Three classes of failure we surface specifically:
  //
  //   - Zod validation ("Too small / Too large") → almost always a
  //     thin Discord week the model honestly couldn't fill. After the
  //     min(1) schema fix, this should be rare but worth surfacing.
  //   - Model timeout (DeadlineExceeded / abort) → transient, the user
  //     should retry; not their fault.
  //   - Anything else → real bug, log + show a generic message but
  //     mark the error category so support can correlate.
  const communityType = server.community_type || "general";
  let result;
  try {
    result = await runPipeline({
      communityType,
      serverName: server.name,
      messages: allMessages,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-now] pipeline failed", err);
    // Schema-validation: the model returned a shape Zod rejected.
    // Usually means thin week / not enough stories worth telling.
    if (/Type validation failed|ZodError|too_small|too_big/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "We couldn't find enough material in this week's messages to write a draft. Try again next week, or pick a Discord with more channels selected.",
          category: "thin_week",
        },
        { status: 422 },
      );
    }
    // Model timeout / abort — Gemini occasionally times out on long
    // contexts; one retry usually clears it.
    if (/DeadlineExceeded|aborted|timeout|ETIMEDOUT/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "The model timed out reading your week. Try again — usually clears in a minute.",
          category: "timeout",
        },
        { status: 504 },
      );
    }
    // Quota / rate limit from Gemini.
    if (/quota|rate.?limit|RESOURCE_EXHAUSTED|429/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "We're rate-limited by the model provider right now. Try again in a few minutes.",
          category: "rate_limit",
        },
        { status: 503 },
      );
    }
    // Catch-all. Don't leak stack frames to the UI but keep enough
    // signal that the user can tell us "it failed at generation
    // time" vs "it failed at save time."
    return NextResponse.json(
      {
        error:
          "Generation failed. We've logged it — please try again, and if it keeps failing, drop us a line.",
        category: "internal",
      },
      { status: 500 },
    );
  }

  // 6. Save newsletter via Go API (marked as on-demand)
  const saveRes = await goFetch(`/api/servers/${id}/newsletters`, {
    method: "POST",
    body: JSON.stringify({
      draft_markdown: result.markdown,
      cost_usd: result.costUsd,
      pass1_tokens_in: result.pass1TokensIn,
      pass1_tokens_out: result.pass1TokensOut,
      pass2_tokens_in: result.pass2TokensIn,
      pass2_tokens_out: result.pass2TokensOut,
      is_on_demand: true,
    }),
  });

  if (!saveRes.ok) {
    return NextResponse.json({
      markdown: result.markdown,
      cost_usd: result.costUsd,
      saved: false,
    });
  }

  const newsletter = await saveRes.json();
  return NextResponse.json({
    id: newsletter.id,
    markdown: result.markdown,
    cost_usd: result.costUsd,
    saved: true,
  });
}
