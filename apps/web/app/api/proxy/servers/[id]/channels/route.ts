import { NextRequest, NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  const resp = await goFetch(`/api/servers/${id}/channels`, { method: "POST", body });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
