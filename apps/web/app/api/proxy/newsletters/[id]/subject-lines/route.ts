import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { runSubjectLines } from "@/lib/ai/subject-lines";

export const maxDuration = 60;

// Body schema. Optional currentMarkdown lets the editor pass its
// unsaved local content — picking subject lines for what the operator
// actually sees, not what was persisted. Falls back to the saved
// draft.
const RequestSchema = z.object({
  currentMarkdown: z.string().min(1).max(20_000).optional(),
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
  const body = await req.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Claim a daily-quota slot before running the (paid) LLM call.
  const quotaRes = await goFetch("/api/usage/subject_lines", {
    method: "POST",
  });
  if (quotaRes.status === 429) {
    const q = await quotaRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: q.error || "Daily limit reached for subject-line generation." },
      { status: 429 },
    );
  }
  if (!quotaRes.ok) {
    return NextResponse.json(
      { error: "Couldn't verify your usage quota. Please try again." },
      { status: 503 },
    );
  }

  const nlRes = await goFetch(`/api/newsletters/${id}`);
  if (!nlRes.ok) {
    return NextResponse.json(
      { error: "newsletter not found" },
      { status: nlRes.status },
    );
  }
  const nl = await nlRes.json();
  const markdown =
    parsed.data.currentMarkdown ||
    (typeof nl.edited_markdown === "string" && nl.edited_markdown) ||
    (typeof nl.draft_markdown === "string" && nl.draft_markdown) ||
    "";
  if (!markdown) {
    return NextResponse.json(
      { error: "newsletter has no content" },
      { status: 400 },
    );
  }

  const serverRes = await goFetch(`/api/servers/${nl.server_id}`);
  const server = serverRes.ok ? await serverRes.json() : { name: "the community" };

  try {
    const result = await runSubjectLines({
      communityName: server.name || "the community",
      newsletterMarkdown: markdown,
    });
    return NextResponse.json({
      options: result.options,
      cost_usd: result.costUsd,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[subject-lines] failed", err);
    if (/DeadlineExceeded|aborted|timeout|ETIMEDOUT/i.test(msg)) {
      return NextResponse.json(
        { error: "Subject-line generation timed out. Try again." },
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
      { error: "Couldn't generate subject lines. Try again." },
      { status: 500 },
    );
  }
}
