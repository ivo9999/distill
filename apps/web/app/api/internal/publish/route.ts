import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { BeehiivPublisher } from "@/lib/publishing/beehiiv";
import { ConvertKitPublisher } from "@/lib/publishing/convertkit";
import { GhostPublisher } from "@/lib/publishing/ghost";
import type { Publisher } from "@/lib/publishing/types";

const RequestSchema = z.object({
  markdown: z.string(),
  subject: z.string(),
  platform: z.enum(["beehiiv", "convertkit", "ghost"]),
  api_key: z.string(),
  publication_id: z.string().optional(),
});

const publishers: Record<string, Publisher> = {
  beehiiv: new BeehiivPublisher(),
  convertkit: new ConvertKitPublisher(),
  ghost: new GhostPublisher(),
};

// Constant-time bearer-token check. Length-guards first (timingSafeEqual
// throws on unequal lengths), so a wrong-length token fails fast without
// leaking timing on the compare itself.
function validInternalKey(authHeader: string | null): boolean {
  const expected = `Bearer ${process.env.INTERNAL_API_KEY ?? ""}`;
  if (!authHeader || authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!validInternalKey(authHeader)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { markdown, subject, platform, api_key, publication_id } = parsed.data;

  const publisher = publishers[platform];

  const result = await publisher.publish({
    markdown,
    subject,
    apiKey: api_key,
    publicationId: publication_id,
  });

  return NextResponse.json({ published_url: result.publishedUrl });
}
