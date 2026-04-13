import { auth } from "./auth";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";

export async function goFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const userId = (session as any).userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "no user id" }), { status: 401 });
  }

  const url = `${GO_API_URL}${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${userId}`);
  headers.set("Content-Type", "application/json");

  return fetch(url, { ...init, headers });
}
