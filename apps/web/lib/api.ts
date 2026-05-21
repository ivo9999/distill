import { auth } from "./auth";
import { NextResponse } from "next/server";

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

// proxyJson forwards a request to the Go API via goFetch and returns
// the JSON response. On a network failure (Go API unreachable) it
// returns a clean 503 instead of letting the exception bubble into a
// raw Next.js 500.
export async function proxyJson(
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  try {
    const resp = await goFetch(path, init);
    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
