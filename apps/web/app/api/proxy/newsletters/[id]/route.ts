import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyJson(`/api/newsletters/${id}`);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  return proxyJson(`/api/newsletters/${id}`, { method: "PATCH", body });
}
