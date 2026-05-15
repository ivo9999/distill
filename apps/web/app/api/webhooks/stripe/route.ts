import { NextRequest, NextResponse } from "next/server";

/* -----------------------------------------------------------------------
   Stripe webhook proxy.

   The Go api service is --internal=on (audit finding 17 — its bearer-token
   auth trusts any UUID, which is only safe while api is unreachable from
   the public internet). Stripe needs a publicly-reachable URL, so this
   route on the web service (which IS publicly exposed at
   https://distill.sislelabs.com) acts as a thin pass-through:

     Stripe → https://distill.sislelabs.com/api/webhooks/stripe
            → web verifies signature edge-side (defense-in-depth)
            → web forwards raw body + headers to api over the cluster network
            → api verifies signature AGAIN (the canonical check) + dispatches

   The two-signature-check is deliberate: web stops obviously bad traffic
   at the edge before it crosses the cluster boundary, and api can't be
   tricked even if the proxy is bypassed (defense in depth against a
   future config drift that exposes api directly).

   IMPORTANT: Stripe's HMAC is computed over the raw request body. Any
   reserialization (JSON.parse then JSON.stringify) breaks the signature.
   We pass req.text() through untouched.
   --------------------------------------------------------------------- */

// Stripe's @stripe/stripe-js verify path requires the Node runtime; we
// also want the raw body unparsed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not configured on web");
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "missing stripe-signature header" },
      { status: 400 },
    );
  }

  const body = await req.text();

  // Edge-side signature check. We import lazily so the route's cold-start
  // cost on non-webhook traffic stays near zero.
  const StripeCtor = (await import("stripe")).default;
  // apiVersion is cast to satisfy the SDK's strict union type; the
  // version pin matters for backwards-compatibility, not for
  // signature verification.
  const stripe = new StripeCtor(process.env.STRIPE_SECRET_KEY || "dummy", {
    apiVersion: "2024-11-20.acacia" as never,
  });

  try {
    stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.warn("[stripe webhook] edge signature check failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Forward raw body + the Stripe-Signature header to the internal api.
  // api will verify the signature itself; we deliberately do not strip
  // anything from the headers.
  const forwardRes = await fetch(`${GO_API_URL}/api/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": sig,
    },
    body,
  });

  if (!forwardRes.ok) {
    const text = await forwardRes.text().catch(() => "");
    console.error("[stripe webhook] api forward failed", forwardRes.status, text);
    return NextResponse.json(
      { error: "api forwarding failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
