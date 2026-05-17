import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
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
