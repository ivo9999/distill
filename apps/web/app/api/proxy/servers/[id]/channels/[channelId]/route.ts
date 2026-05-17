import { NextRequest, NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> },
) {
  const { id, channelId } = await params;
  const body = await req.text();
  const resp = await goFetch(`/api/servers/${id}/channels/${channelId}`, {
    method: "PATCH",
    body,
  });
  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> },
) {
  const { id, channelId } = await params;
  const resp = await goFetch(`/api/servers/${id}/channels/${channelId}`, { method: "DELETE" });
  // The Go handler returns 204 No Content, which has no body — don't
  // try to parse JSON or the proxy will 500 on a successful delete.
  if (resp.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const data = await resp.json().catch(() => ({}));
  return NextResponse.json(data, { status: resp.status });
}
