import { NextRequest, NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const body = await req.text();
  const resp = await goFetch(`/api/integrations/${platform}`, { method: "POST", body });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const resp = await goFetch(`/api/integrations/${platform}`, { method: "DELETE" });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
