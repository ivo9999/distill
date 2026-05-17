import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import {
  runRegenerateSection,
  type RegenerateDirective,
} from "@/lib/ai/regenerate-section";

export const maxDuration = 60;

// Body schema. We accept currentSection from the client because the
// editor may have edited it locally before requesting a rewrite — we
// want to operate on what the user sees, not what's persisted.
const RequestSchema = z.object({
  storyId: z.string(),
  currentSection: z.string().min(1).max(4000),
  directive: z.enum(["tighter", "funnier", "more_detail", "rewrite_from_messages"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Load the newsletter so we can (a) confirm it exists + the user
  // owns it (the Go API enforces this via the session bearer), and
  // (b) pull the source-messages map for this specific storyId.
  const nlRes = await goFetch(`/api/newsletters/${id}`);
  if (!nlRes.ok) {
    return NextResponse.json(
      { error: "newsletter not found" },
      { status: nlRes.status },
    );
  }
  const nl = await nlRes.json();
  const sources = Array.isArray(nl.sources) ? nl.sources : [];
  const source = sources.find(
    (s: { storyId?: string }) => s.storyId === parsed.data.storyId,
  );
  if (!source) {
    return NextResponse.json(
      { error: "section source not found — regenerate the whole draft first" },
      { status: 404 },
    );
  }

  // The newsletter belongs to a server; grab its name for the
  // {{COMMUNITY_NAME}} slot in the prompt.
  const serverRes = await goFetch(`/api/servers/${nl.server_id}`);
  const server = serverRes.ok ? await serverRes.json() : { name: "the community" };

  try {
    const result = await runRegenerateSection({
      communityName: server.name || "the community",
      directive: parsed.data.directive as RegenerateDirective,
      currentSection: parsed.data.currentSection,
      source,
    });
    return NextResponse.json({
      markdown: result.markdown,
      cost_usd: result.costUsd,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[regenerate-section] failed", err);
    if (/DeadlineExceeded|aborted|timeout|ETIMEDOUT/i.test(msg)) {
      return NextResponse.json(
        { error: "Rewrite timed out. Try again — usually clears in a minute." },
        { status: 504 },
      );
    }
    if (/quota|rate.?limit|RESOURCE_EXHAUSTED|429/i.test(msg)) {
      return NextResponse.json(
        { error: "We're rate-limited right now. Try again in a few minutes." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Rewrite failed. Try again, or pick a different directive." },
      { status: 500 },
    );
  }
}
