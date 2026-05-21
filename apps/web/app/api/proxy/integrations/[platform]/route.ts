import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const body = await req.text();
  return proxyJson(`/api/integrations/${platform}`, { method: "POST", body });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  return proxyJson(`/api/integrations/${platform}`, { method: "DELETE" });
}
