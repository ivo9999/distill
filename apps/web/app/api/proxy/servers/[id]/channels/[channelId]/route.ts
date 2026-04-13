import { NextRequest, NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> },
) {
  const { id, channelId } = await params;
  const resp = await goFetch(`/api/servers/${id}/channels/${channelId}`, { method: "DELETE" });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
