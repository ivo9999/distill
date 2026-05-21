import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyJson("/api/billing/checkout", { method: "POST", body });
}
