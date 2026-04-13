import { NextRequest, NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function GET() {
  const resp = await goFetch("/api/servers");
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const resp = await goFetch("/api/servers", { method: "POST", body });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
