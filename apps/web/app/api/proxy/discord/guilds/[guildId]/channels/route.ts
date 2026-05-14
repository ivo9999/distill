import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const accessToken = (session as any).accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "no discord access token" }, { status: 401 });
  }

  const { guildId } = await params;

  const resp = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/channels`,
    { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
  );
  const data = await resp.json();

  if (!resp.ok) {
    return NextResponse.json(data, { status: resp.status });
  }

  // Filter to text channels only (type 0) and return id + name
  const textChannels = data
    .filter((ch: any) => ch.type === 0)
    .sort((a: any, b: any) => a.position - b.position)
    .map((ch: any) => ({ id: ch.id, name: ch.name }));

  return NextResponse.json(textChannels);
}
