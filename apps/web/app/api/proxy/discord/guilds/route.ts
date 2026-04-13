import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const accessToken = (session as any).accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "no discord access token" }, { status: 401 });
  }

  const resp = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
