import { proxyJson } from "@/lib/api";

export async function GET() {
  return proxyJson("/api/me");
}

export async function DELETE() {
  return proxyJson("/api/me", { method: "DELETE" });
}
