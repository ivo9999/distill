import { NextRequest, NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const resp = await goFetch("/api/billing/portal", { method: "POST", body });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
