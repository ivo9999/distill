import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { signInWithDiscord } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { FAQ } from "./_components/faq";
import { cn } from "@/lib/utils";

/* -----------------------------------------------------------------------
   Distill landing. Voice + composition rules:

   - Open with the inbox-shame, not the feature. The reader feels seen
     before they hear the pitch.
   - One specific number per section. "1,243 messages → 6 stories →
     10-minute edit." A real claim, not a vibe.
   - No "AI" copy. The reader has seen 200 GPT wrappers. We say editor,
     reader, summary, writer.
   - No gradient text. No pill chips. No fake product screenshots. The
     right-column hero artifact is the actual markdown a draft looks
     like — paste-able, real.
   - Section labels are a `// mono comment` so they read as captions
     and ground the page in a builder aesthetic.
   --------------------------------------------------------------------- */

const proFeatures = [
  "A new draft every Sunday morning",
  "Generate any time — for any week, on demand",
  "Publish straight to Beehiiv, ConvertKit, or Ghost",
  "Connect every Discord you own",
  "Members opt out with one slash command",
  "Two-pass writer — finds the story, then writes it",
];

const freeFeatures = [
  "One full draft, on us, no card required",
  "Same editor, same markdown, same preview",
  "Members opt out the same way",
  "Keep the draft forever — yours either way",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Nav />
      <main>
        <Hero />
        <Pain />
        <HowItWorks />
        <Features />
        <WhyNotDIY />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

/* ---- Nav ---- */
function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-ink-lighter/60 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-black tracking-tight">
          <BrandMark className="h-5 w-auto" />
          distill
        </Link>
        <div className="hidden items-center gap-7 sm:flex">
          {[
            { href: "#how", label: "How it works" },
            { href: "#pricing", label: "Pricing" },
            { href: "#faq", label: "FAQ" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink-medium hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={signInWithDiscord} className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </form>
          <form action={signInWithDiscord}>
            <Button variant="primary" size="sm">
              Try free
            </Button>
          </form>
        </div>
      </div>
    </nav>
  );
}

/* ---- Hero ---- */
function Hero() {
  return (
    <section className="px-4 pt-20 pb-20 sm:px-6 md:pt-32 md:pb-32">
      <div className="mx-auto w-full max-w-[1100px]">
        <SectionLabel>{"// for community owners who haven't sent the email"}</SectionLabel>

        <div className="mt-6 grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          {/* Left — the pitch */}
          <div>
            <h1 className="text-[clamp(40px,5.6vw,68px)] font-black leading-[1.04] tracking-tight">
              Your list is waiting.
              <br />
              <span className="text-ink-medium">Your community already wrote the email.</span>
            </h1>

            <p className="mt-7 max-w-[540px] text-[17px] leading-relaxed text-ink-medium sm:text-[19px]">
              You haven&apos;t emailed your list in weeks. Not because nothing&apos;s happening
              — your Discord is on fire. Because you can&apos;t bring yourself to sit down
              and write it up. Distill writes it up. You spend ten minutes making it
              yours, and ship.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <form action={signInWithDiscord}>
                <Button variant="primary" size="lg" className="h-[52px] px-8 text-base">
                  Get your first draft free
                  <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </form>
              <Button variant="outline" size="lg" className="h-[52px] px-6 text-base" asChild>
                <a href="#how">See an example draft</a>
              </Button>
            </div>

            <p className="mt-5 max-w-[460px] text-[13px] text-ink-medium">
              One full draft per Discord, no card. If it&apos;s any good, the rest is $49/mo.
              If it isn&apos;t, you keep the draft.
            </p>
          </div>

          {/* Right — the actual artifact, not a mockup */}
          <DraftArtifact />
        </div>
      </div>
    </section>
  );
}

/* ---- Draft artifact: real markdown, paste-able ---- */
function DraftArtifact() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-card border border-ink-lighter bg-canvas shadow-card transition-shadow duration-200 hover:shadow-card">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-ink-lighter px-4 py-2.5 bg-ink-lightest/60">
          <span className="size-2.5 rounded-full bg-ink-light" />
          <span className="size-2.5 rounded-full bg-ink-light" />
          <span className="size-2.5 rounded-full bg-ink-light" />
          <span className="ml-2 font-mono text-[11px] text-ink-medium">
            week-of-may-12.md
          </span>
        </div>

        {/* The draft itself */}
        <div className="space-y-4 px-5 py-6 font-mono text-[12.5px] leading-[1.75] text-ink">
          <p className="text-ink">
            <span className="text-brand">#</span> Week of May 12
          </p>

          <p className="text-ink-medium">
            Quiet week on the surface, loud one underneath. Six people argued about
            Stripe webhook reliability for three days, someone shipped a CLI tool
            that picked up 200 stars overnight, and a regular posted the kind of
            late-night message you screenshot and keep.
          </p>

          <p className="text-ink">
            <span className="text-brand">##</span> The Stripe webhook thing
          </p>

          <p className="text-ink-medium">
            It started with one question in #backend. By the third day, the thread
            had a 90-line code sample and a small consensus: idempotency keys per
            event, not per request. The folks who disagreed had good reasons.
            Worth reading the whole thing if you ever take money.
          </p>

          <p className="text-ink">
            <span className="text-brand">##</span> 200 stars in 11 hours
          </p>

          <p className="text-ink-medium">
            One link in #show-work. By morning a member&apos;s side project was at
            the top of Hacker News and they were getting their first contributor
            PRs. We&apos;ve linked the repo below.
          </p>

          <p className="italic text-ink-medium">
            <span className="not-italic">*</span>What to watch next week: a
            handful of people testing a Postgres extension someone in #db wrote
            on Sunday.<span className="not-italic">*</span>
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-5 border-t border-ink-lighter px-5 py-3 text-[11px] text-ink-medium">
          <span>
            <span className="font-semibold tabular-nums text-ink">1,243</span> messages read
          </span>
          <span>
            <span className="font-semibold tabular-nums text-ink">6</span> stories found
          </span>
          <span className="hidden sm:inline">
            <span className="font-semibold tabular-nums text-ink">~10 min</span> to edit
          </span>
        </div>
      </div>

      <p className="mt-3 text-center font-mono text-[11px] text-ink-medium">
        what arrives in your dashboard every Sunday morning
      </p>
    </div>
  );
}

/* ---- Pain section ---- */
function Pain() {
  const internalMonologue = [
    "I should send the email this week.",
    "Honestly I should have sent it three weeks ago.",
    "What do I even say. Nothing happened. Wait, something did, but I can't remember what.",
    "I'll scroll the Discord later and write something good.",
    "It's 11pm Sunday. I'll send it next week.",
  ];

  return (
    <section className="border-t border-ink-lighter/60 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[920px]">
        <SectionLabel>{"// the actual problem"}</SectionLabel>

        <h2 className="mt-6 text-[clamp(28px,4.2vw,48px)] font-black leading-[1.1] tracking-tight">
          You didn&apos;t run out of subscribers.
          <br />
          You ran out of <span className="underline decoration-brand decoration-[3px] underline-offset-[6px]">Sundays.</span>
        </h2>

        <p className="mt-7 max-w-[640px] text-[17px] leading-relaxed text-ink-medium sm:text-[19px]">
          The community is the easy part. The community is doing fine. You opened the
          editor again last weekend. Here&apos;s how that went:
        </p>

        <div className="mt-10 space-y-3 border-l-2 border-brand pl-6 sm:pl-8">
          {internalMonologue.map((line, i) => (
            <p
              key={i}
              className={cn(
                "text-[15px] leading-relaxed sm:text-[17px]",
                i === internalMonologue.length - 1 ? "text-ink font-semibold" : "text-ink-medium",
              )}
            >
              {line}
            </p>
          ))}
        </div>

        <div className="mt-12 grid gap-6 border-t border-ink-lighter pt-10 sm:grid-cols-[auto_1fr] sm:gap-10">
          <p className="font-mono text-[clamp(28px,4vw,44px)] font-bold leading-none">
            <span className="text-brand-hot">11</span>
            <span className="text-ink-medium"> weeks</span>
          </p>
          <p className="text-[15px] leading-relaxed text-ink-medium sm:text-[17px]">
            since your last email. Open rates are about to fall off a cliff —
            that&apos;s the part of the inbox where Gmail starts deciding you might be
            spam. The longer you wait, the more it costs to come back.
          </p>
        </div>

        <p className="mt-10 max-w-[640px] text-[17px] leading-relaxed text-ink sm:text-[19px]">
          You don&apos;t need to write a better newsletter. You need a newsletter to
          already be written when you sit down.{" "}
          <span className="font-semibold">That&apos;s the whole product.</span>
        </p>
      </div>
    </section>
  );
}

/* ---- How it works ---- */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Add the bot to your Discord",
      desc: "Pick the channels worth reading. Two minutes. The bot can only see what you point it at — announcements and support stay out.",
      ribbon: "bg-brand-discord",
    },
    {
      n: "02",
      title: "Sunday morning, a draft appears",
      desc: "Distill reads the week — every message in every channel you picked — and finds the six things worth saying. Then it writes them up in plain prose. No bullet-vomit, no LinkedIn voice, no em-dash maximalism.",
      ribbon: "bg-brand",
    },
    {
      n: "03",
      title: "Ten minutes of edits. Hit send.",
      desc: "Open the editor. Cut what doesn't fit, rewrite the intro in your voice, add a personal note. One click to Beehiiv, ConvertKit, or Ghost. Done before coffee.",
      ribbon: "bg-brand-warm",
    },
  ];

  return (
    <section id="how" className="border-t border-ink-lighter/60 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel>{"// how it works"}</SectionLabel>

        <h2 className="mt-6 max-w-[820px] text-[clamp(28px,4.2vw,48px)] font-black leading-[1.1] tracking-tight">
          Three steps. None of them is &quot;sit down and write a newsletter.&quot;
        </h2>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="group relative overflow-hidden rounded-card border border-ink-lighter bg-canvas p-7 shadow-card transition-shadow duration-200 hover:shadow-card"
            >
              <span
                aria-hidden
                className={cn("absolute inset-x-0 top-0 h-1", s.ribbon)}
              />
              <span className="font-mono text-[13px] tracking-wider text-ink-medium">
                {s.n}
              </span>
              <h3 className="mt-3 text-[18px] font-black leading-tight tracking-tight">{s.title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-medium">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- Features ---- */
function Features() {
  const features = [
    {
      title: "Reads your week, not a summary of it",
      desc: "Two-pass writer. First pass scans every message and finds the six conversations worth telling. Second pass writes them in prose, not bullets. The result reads like something a person wrote — because the people in your Discord did.",
      stat: "1,243 → 6",
      statLabel: "messages → stories",
    },
    {
      title: "Members can opt out, instantly",
      desc: "Anyone in your Discord types /distill optout and their messages are gone — never read, never quoted, never stored. We anonymize everyone by default. Nobody gets named in the email unless you put their name in yourself.",
      stat: "/distill optout",
      statLabel: "one slash command",
    },
    {
      title: "Markdown in, markdown out",
      desc: "The draft is a text file. Edit it like one. We don't lock you into a WYSIWYG that fights you. Cut a section, rewrite the intro, paste it anywhere. The dashboard has a live preview, but you don't have to use it.",
      stat: ".md",
      statLabel: "no proprietary format",
    },
    {
      title: "Publishes where you already are",
      desc: "Beehiiv, ConvertKit, Ghost. One API key per platform, set it once. The publish button does the rest. Substack doesn't have a public API — when they ship one, we'll be there.",
      stat: "3 platforms",
      statLabel: "1 click",
    },
  ];

  return (
    <section className="border-t border-ink-lighter/60 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel>{"// what you actually get"}</SectionLabel>

        <h2 className="mt-6 max-w-[760px] text-[clamp(28px,4.2vw,48px)] font-black leading-[1.1] tracking-tight">
          A first draft so good you only have to be the editor.
        </h2>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-4 rounded-card border border-ink-lighter bg-canvas p-7 shadow-card transition-shadow duration-200 hover:shadow-card"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-mono text-[18px] font-bold tabular-nums text-brand">
                  {f.stat}
                </span>
                <span className="font-mono text-[11px] tracking-wider text-ink-medium">
                  {f.statLabel}
                </span>
              </div>
              <h3 className="text-[18px] font-black leading-tight tracking-tight">{f.title}</h3>
              <p className="text-[14px] leading-relaxed text-ink-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- Why not DIY ---- */
function WhyNotDIY() {
  return (
    <section className="border-t border-ink-lighter/60 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[920px]">
        <SectionLabel>{"// the obvious objection"}</SectionLabel>

        <h2 className="mt-6 max-w-[760px] text-[clamp(28px,4.2vw,48px)] font-black leading-[1.1] tracking-tight">
          &quot;I could just write it myself in 30 minutes.&quot;
        </h2>

        <p className="mt-7 max-w-[640px] text-[17px] leading-relaxed text-ink-medium sm:text-[19px]">
          You could. You haven&apos;t. That&apos;s the disconnect.
        </p>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 sm:gap-10">
          <div className="rounded-card border border-ink-lighter bg-canvas p-6 shadow-card">
            <p className="font-mono text-[12px] uppercase tracking-wider text-ink-medium">
              The fantasy version
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-medium">
              Sunday morning, coffee, you scroll the week&apos;s Discord, get inspired,
              write a 600-word email in 30 minutes, hit send by 11. Inbox happy,
              list growing, churn falling.
            </p>
          </div>
          <div className="rounded-card border border-brand bg-brand-soft p-6 shadow-card">
            <p className="font-mono text-[12px] uppercase tracking-wider text-brand">
              What actually happens
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink">
              You open the editor, stare at the cursor, think &quot;nothing
              interesting happened&quot;, scroll Discord for 20 minutes, realize a lot
              happened but you can&apos;t structure it, write half a paragraph, hate
              it, close the tab. Next Sunday: same.
            </p>
          </div>
        </div>

        <p className="mt-12 max-w-[640px] text-[17px] leading-relaxed text-ink sm:text-[19px]">
          The bottleneck isn&apos;t the writing. It&apos;s the empty page. Distill removes
          the empty page. Once you&apos;re editing instead of writing, you finish.{" "}
          <span className="font-semibold">Every time. That&apos;s the whole trick.</span>
        </p>
      </div>
    </section>
  );
}

/* ---- Pricing ---- */
function Pricing() {
  return (
    <section id="pricing" className="border-t border-ink-lighter/60 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[1100px]">
        <SectionLabel>{"// pricing"}</SectionLabel>

        <h2 className="mt-6 max-w-[760px] text-[clamp(28px,4.2vw,48px)] font-black leading-[1.1] tracking-tight">
          One Sunday saved pays for the year.
        </h2>
        <p className="mt-5 max-w-[600px] text-[17px] leading-relaxed text-ink-medium">
          You can cancel any time. We&apos;ll still keep your drafts if you do.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {/* Free */}
          <PricingCard
            name="Free"
            blurb="One full draft on your real Discord. If we get the voice right, you&apos;ll know on draft one."
            price="$0"
            cadence="forever"
            features={freeFeatures}
            cta={
              <form action={signInWithDiscord}>
                <Button variant="outline" className="w-full">
                  Start free
                </Button>
              </form>
            }
          />
          {/* Pro */}
          <PricingCard
            name="Pro"
            blurb="A draft every Sunday, plus on-demand any other day. Publish straight to your platform."
            price="$49"
            cadence="/month"
            badge="Recommended"
            features={proFeatures}
            cta={
              <form action={signInWithDiscord}>
                <Button variant="primary" className="w-full">
                  Subscribe — $49/mo
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </form>
            }
          />
        </div>

        <p className="mt-8 max-w-[640px] text-[13px] text-ink-medium">
          Math: at $49/mo, Distill costs $588/year. A community owner&apos;s hour
          costs more than that. We save you 30+ hours of writing block per
          year. The annoying part is that this is the truth.
        </p>
      </div>
    </section>
  );
}

function PricingCard({
  name,
  blurb,
  price,
  cadence,
  features,
  cta,
  badge,
}: {
  name: string;
  blurb: string;
  price: string;
  cadence: string;
  features: string[];
  cta: React.ReactNode;
  badge?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-card bg-canvas p-8 shadow-card",
        badge ? "border-2 border-brand" : "border border-ink-lighter",
      )}
    >
      {badge && (
        <span className="absolute -top-3 left-8 rounded-pill bg-brand px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-foreground">
          {badge}
        </span>
      )}
      <h3 className="text-[20px] font-black tracking-tight">{name}</h3>
      <p className="mt-2 text-[14px] text-ink-medium">{blurb}</p>
      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-[44px] font-black tabular-nums tracking-tight">{price}</span>
        <span className="text-[14px] text-ink-medium">{cadence}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink-medium">
            <Check className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8">{cta}</div>
    </div>
  );
}

/* ---- Final CTA ---- */
function FinalCTA() {
  return (
    <section className="border-t border-ink-lighter/60 px-4 py-24 sm:px-6 md:py-32">
      <div className="mx-auto max-w-[820px]">
        <h2 className="text-[clamp(28px,4.6vw,52px)] font-black leading-[1.05] tracking-tight">
          Your subscribers are still there.
          <br />
          <span className="text-ink-medium">They&apos;ve been there the whole time.</span>
        </h2>
        <p className="mt-7 max-w-[600px] text-[17px] leading-relaxed text-ink-medium sm:text-[19px]">
          Try one draft. If we don&apos;t nail your community&apos;s voice on the first
          try, you walk away with a free file and nothing else. If we do — well,
          you already know what Sunday morning is going to look like.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <form action={signInWithDiscord}>
            <Button variant="primary" size="lg" className="h-[52px] px-8 text-base">
              Generate your first draft
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </form>
          <Button variant="outline" size="lg" className="h-[52px] px-6 text-base" asChild>
            <a href="#pricing">Compare plans</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ---- Footer ---- */
function Footer() {
  return (
    <footer className="border-t border-ink-lighter/60 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 text-sm font-black tracking-tight">
          <BrandMark className="h-5 w-auto" />
          distill
        </span>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ink-medium">
          <span>Beehiiv</span>
          <span>ConvertKit</span>
          <span>Ghost</span>
          <span className="text-ink-light">·</span>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </div>
        <span className="text-[13px] text-ink-medium">
          Built by SisleLabs in Sofia · © 2026
        </span>
      </div>
    </footer>
  );
}

/* ---- Helpers ---- */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[13px] tracking-wider text-brand sm:text-[14px]">
      {children}
    </p>
  );
}
