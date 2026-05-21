import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyJson(`/api/servers/${id}/channels`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  return proxyJson(`/api/servers/${id}/channels`, { method: "POST", body });
}
