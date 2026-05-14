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
    return NextResponse.json({ error: msg, tier: quota.tier }, { status: 402 });
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
    return NextResponse.json(
      { error: "No messages found in your channels from the past week. Try posting some messages first!" },
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

  // 5. Run the AI pipeline
  const communityType = server.community_type || "general";
  const result = await runPipeline({
    communityType,
    serverName: server.name,
    messages: allMessages,
  });

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
