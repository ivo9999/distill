import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Rate-limits the proxy API surface. The generate/LLM routes get a
// tighter bucket than the rest. Keyed by client IP (middleware runs
// before route auth, so the session user id is not yet available — IP
// is the available signal at this layer; the Go API additionally
// limits per-user).
export const config = {
  matcher: ["/api/proxy/:path*"],
};

export async function middleware(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const path = req.nextUrl.pathname;

  // Expensive generation routes: tight bucket. Everything else: loose.
  const isGenerate = /\/generate|\/regenerate-section|\/subject-lines/.test(path);
  const [limit, windowSec] = isGenerate ? [10, 60] : [120, 60];

  const ok = await rateLimit(`${ip}:${isGenerate ? "gen" : "api"}`, limit, windowSec);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests — please slow down." },
      { status: 429 },
    );
  }
  return NextResponse.next();
}
