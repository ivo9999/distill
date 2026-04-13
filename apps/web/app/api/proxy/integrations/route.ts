import { NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function GET() {
  const resp = await goFetch("/api/integrations");
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
