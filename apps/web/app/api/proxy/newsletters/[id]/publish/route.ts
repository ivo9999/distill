import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.text();
  return proxyJson(`/api/newsletters/${id}/publish`, { method: "POST", body });
}
