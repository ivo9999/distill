import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Distill",
  description: "How Distill collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-ink-medium hover:text-ink">
        ← Back to Distill
      </Link>
      <h1 className="mt-6 text-3xl font-black tracking-tight text-ink">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm italic text-ink-medium">
        Last updated 21 May 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-medium">
        <section>
          <h2 className="text-lg font-bold text-ink">Who we are</h2>
          <p className="mt-2">
            Distill is operated by SisleLabs, based in Sofia, Bulgaria.
            Distill turns activity in your Discord community into a
            weekly newsletter draft. This policy explains what data we
            collect, why, and your rights over it. Questions:
            contact us at the email on our site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Your account:</strong> your Discord user ID,
              username, avatar, and email address, received from Discord
              when you sign in.
            </li>
            <li>
              <strong>Discord messages:</strong> messages from the
              specific channels you choose to monitor — their text,
              author, timestamps, and reaction counts — so we can
              generate your newsletter.
            </li>
            <li>
              <strong>Billing:</strong> if you subscribe, Stripe
              processes your payment. We store only a Stripe customer
              reference and your subscription status — never your card
              details.
            </li>
            <li>
              <strong>Your content:</strong> the newsletter drafts we
              generate and any edits you make.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">How we use it</h2>
          <p className="mt-2">
            Monitored-channel messages are sent to Google&apos;s Gemini
            API to generate your newsletter draft. They are not used to
            train any model. We use your account data to operate your
            account and your billing data to manage your subscription.
            We do not sell your data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">
            Message retention
          </h2>
          <p className="mt-2">
            Raw Discord messages we collect are automatically deleted
            within 30 days. If a member of your Discord types{" "}
            <code className="font-mono">/distill optout</code>, their
            messages are excluded from all future drafts and their
            already-collected messages are deleted immediately. Deleting
            a server, or your account, deletes all associated data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">
            Third parties
          </h2>
          <p className="mt-2">
            We share data only with the services needed to run Distill:
            Discord (authentication and message access), Google Gemini
            (newsletter generation), Stripe (payments), and — only if
            you connect them — your chosen newsletter platform (Beehiiv,
            ConvertKit, or Ghost) to publish drafts you approve.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">Your rights</h2>
          <p className="mt-2">
            You can delete your account at any time from your profile
            page, which permanently removes your data. As Distill is
            operated from the EU, you also have the rights granted by
            the GDPR, including access, correction, and erasure. Contact
            us to exercise them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink">Changes</h2>
          <p className="mt-2">
            We may update this policy; material changes will be
            reflected in the &ldquo;last updated&rdquo; date above.
          </p>
        </section>
      </div>
    </main>
  );
}
