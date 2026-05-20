import { NextResponse } from "next/server";
import { goFetch } from "@/lib/api";

export async function GET() {
  const resp = await goFetch("/api/me");
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}

export async function DELETE() {
  const resp = await goFetch("/api/me", { method: "DELETE" });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
