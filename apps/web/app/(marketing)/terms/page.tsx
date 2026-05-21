import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Distill",
  description: "The terms governing your use of Distill.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-ink-medium hover:text-ink">
        ← Back to Distill
      </Link>
      <h1 className="mt-6 text-3xl font-black tracking-tight text-ink">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm italic text-ink-medium">
        Last updated 21 May 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-medium">
        <section>
          <h2 className="text-lg font-bold text-ink">The service</h2>
          <p className="mt-2">
            Distill, operated by SisleLabs (Sofia, Bulgaria), generates
            weekly newsletter drafts from activity in the Discord
            channels you choose to monitor. By using Distill you agree
            to these terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">
            Your responsibilities
          </h2>
          <p className="mt-2">
            You must have the authority to add the Distill bot to a
            Discord server and to monitor the channels you select. You
            are responsible for the newsletters you publish and for
            complying with Discord&apos;s terms and the rules of your
            community. You must not use Distill to break the law or to
            process content you have no right to.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">
            Subscriptions &amp; billing
          </h2>
          <p className="mt-2">
            Distill offers a free tier and a paid subscription at
            $49/month, billed through Stripe. Paid subscriptions renew
            monthly until cancelled. You can cancel at any time from
            your profile; cancellation stops future charges and access
            to paid features ends at the close of the current billing
            period. Because the service is delivered immediately, fees
            already paid are non-refundable except where required by
            law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">
            Acceptable use
          </h2>
          <p className="mt-2">
            Do not abuse the service — including attempting to bypass
            usage limits, overload the system, or access data that is
            not yours. We may suspend accounts that do.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">
            Disclaimer &amp; liability
          </h2>
          <p className="mt-2">
            Distill is provided &ldquo;as is&rdquo;, without warranties
            of any kind. Newsletter drafts are AI-generated and you are
            responsible for reviewing them before publishing. To the
            fullest extent permitted by law, SisleLabs is not liable for
            indirect or consequential damages, and our total liability
            is limited to the fees you paid in the previous 12 months.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">
            Governing law &amp; changes
          </h2>
          <p className="mt-2">
            These terms are governed by the laws of Bulgaria. We may
            update them; material changes will be reflected in the
            &ldquo;last updated&rdquo; date above. Continued use after a
            change means you accept the updated terms.
          </p>
        </section>
      </div>
    </main>
  );
}
