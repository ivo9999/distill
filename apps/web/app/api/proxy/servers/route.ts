import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api";

export async function GET() {
  return proxyJson("/api/servers");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyJson("/api/servers", { method: "POST", body });
}
