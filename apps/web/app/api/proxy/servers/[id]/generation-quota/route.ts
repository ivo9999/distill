import { NextRequest, NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resp = await goFetch(`/api/servers/${id}/generation-quota`);
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
