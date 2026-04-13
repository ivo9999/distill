import { NextRequest, NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resp = await goFetch(`/api/servers/${id}`);
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  const resp = await goFetch(`/api/servers/${id}`, { method: "PATCH", body });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
