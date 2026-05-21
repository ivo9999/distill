import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const accessToken = (session as { accessToken?: string }).accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "no discord access token" }, { status: 401 });
  }

  // The guilds the BOT is in.
  const botResp = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  const botData = await botResp.json();
  if (!botResp.ok) {
    return NextResponse.json(botData, { status: botResp.status });
  }

  // The guilds the USER is in (their own OAuth token).
  const userResp = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userResp.ok) {
    return NextResponse.json(
      { error: "couldn't verify your Discord servers" },
      { status: 502 },
    );
  }
  const userData = await userResp.json();
  const userGuildIds = new Set(
    (Array.isArray(userData) ? userData : []).map((g: { id: string }) => g.id),
  );

  // Only return bot guilds the requesting user also belongs to.
  const guilds = (Array.isArray(botData) ? botData : [])
    .filter((g: { id: string }) => userGuildIds.has(g.id))
    .map((g: { id: string; name: string; icon: string | null }) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
    }));
  return NextResponse.json(guilds);
}
