import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { runPipeline, type Message } from "@/lib/ai/pipeline";

const RequestSchema = z.object({
  community_type: z.string(),
  server_name: z.string(),
  voice_sample: z.string().optional(),
  messages: z.array(
    z.object({
      id: z.string(),
      authorId: z.string(),
      authorName: z.string(),
      content: z.string(),
      timestamp: z.string(),
      reactionCount: z.number(),
      replyCount: z.number(),
      replyToId: z.string().optional(),
      threadId: z.string().optional(),
      channelName: z.string().optional(),
      channelWeight: z.number().optional(),
      discordChannelId: z.string().optional(),
    })
  ),
});

// Constant-time bearer-token check. Length-guards first (timingSafeEqual
// throws on unequal lengths), so a wrong-length token fails fast without
// leaking timing on the compare itself.
function validInternalKey(authHeader: string | null): boolean {
  const key = process.env.INTERNAL_API_KEY ?? "";
  // A missing/empty key must never authenticate anyone — otherwise the
  // expected value collapses to "Bearer " and a 7-char header matches.
  if (!key) return false;
  const expected = `Bearer ${key}`;
  if (!authHeader || authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!validInternalKey(authHeader)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { community_type, server_name, messages, voice_sample } = parsed.data;

  const result = await runPipeline({
    communityType: community_type,
    serverName: server_name,
    messages: messages as Message[],
    voiceSample: voice_sample,
  });

  return NextResponse.json(result);
}
