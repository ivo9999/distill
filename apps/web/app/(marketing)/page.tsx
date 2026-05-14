import Link from "next/link";
import {
  ArrowRight,
  Check,
  Zap,
  Shield,
  Send,
  Plug,
  PenLine,
  Target,
  MessageSquare,
  Clock,
} from "lucide-react";
import { signInWithDiscord } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const proFeatures = [
  "Weekly drafts, every Sunday",
  "Unlimited on-demand generations",
  "Publish to Beehiiv, ConvertKit or Ghost",
  "Members can opt out anytime",
  "Unlimited watched channels",
  "Priority support",
];

const freeFeatures = [
  "1 free generation per server, ever",
  "Markdown editor + preview",
  "Members can opt out anytime",
  "Drafts saved to your dashboard",
];

const faqs = [
  {
    q: "What if I already have a newsletter but never send it?",
    a: "That's exactly who Distill is for. You already have the subscribers and the community. You just need someone to do the first 90% of the writing. That's us.",
  },
  {
    q: "Will it sound like me or like a robot?",
    a: "The draft captures what happened in your community — the stories, the wins, the debates. You spend 10 minutes making it sound like you. Most creators publish with light edits.",
  },
  {
    q: "What platforms does it publish to?",
    a: "Beehiiv, ConvertKit, and Ghost. Substack doesn't have a public API, so we can't support it yet.",
  },
  {
    q: "What about member privacy?",
    a: "Any member can run /distill optout and their messages are permanently excluded. We never store raw messages after the draft is generated. Everything is encrypted.",
  },
  {
    q: "Is the free generation really one per server, ever?",
    a: "Yes. We key it on the Discord guild ID, so making a new account or re-adding the bot doesn't reset it. We do this so you get a real taste of the product without the freebie being gameable.",
  },
];

function Tick() {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-positive/15">
      <Check className="size-3 text-positive" strokeWidth={2.5} />
    </span>
  );
}

function FizzyBlob({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-[54%_46%_61%_39%/_57%_49%_51%_43%] blur-3xl",
        className,
      )}
    />
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-ink">
      {/* Decorative background blobs */}
      <FizzyBlob className="-top-32 -left-32 h-[40rem] w-[40rem] bg-accent-7/20" />
      <FizzyBlob className="top-1/3 -right-40 h-[36rem] w-[36rem] bg-accent-5/15" />
      <FizzyBlob className="bottom-0 left-1/4 h-[30rem] w-[30rem] bg-accent-2/15" />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-ink-lighter/60 bg-canvas/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="relative inline-flex h-7 w-7 items-center justify-center">
              <span
                aria-hidden
                className="absolute inset-0 rounded-[40%_60%_55%_45%/_50%_55%_45%_50%] bg-accent-7"
              />
              <span
                aria-hidden
                className="absolute inset-1 rounded-[55%_45%_60%_40%/_45%_55%_50%_50%] bg-accent-5/80"
              />
            </span>
            distill
          </Link>
          <div className="hidden items-center gap-6 sm:flex">
            {["How it works", "Pricing", "FAQ"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/ /g, "-")}`}
                className="text-sm text-ink-dark hover:text-ink"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signInWithDiscord} className="hidden sm:block">
              <Button variant="ghost" size="sm">Sign in</Button>
            </form>
            <form action={signInWithDiscord}>
              <Button variant="primary" size="sm" className="rounded-pill">
                Try free
                <ArrowRight className="ml-1 size-3" />
              </Button>
            </form>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-12 sm:pt-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-pill border border-ink-lighter bg-canvas/60 px-3 py-1 text-xs text-ink-dark backdrop-blur">
            <span className="inline-block size-1.5 rounded-full bg-positive" />
            Free generation per server — no card required
          </span>
          <h1 className="mb-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Your Discord wrote your newsletter.{" "}
            <span className="bg-gradient-to-br from-accent-7 to-accent-5 bg-clip-text text-transparent">
              Nobody outside sees it.
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-ink-dark sm:text-lg">
            Distill turns your community&apos;s best moments into a newsletter
            draft you can publish in 10 minutes. Your members already did the
            hard part.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <form action={signInWithDiscord}>
              <Button variant="primary" size="lg" className="rounded-pill px-7">
                Generate your first draft free
                <ArrowRight className="ml-1 size-4" />
              </Button>
            </form>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-pill border border-ink-lighter bg-canvas px-7 py-3 text-sm font-medium text-ink hover:bg-ink-lightest transition-colors"
            >
              See how it works
            </a>
          </div>
          <p className="mt-6 text-xs text-ink-medium">
            1 free generation per Discord server, forever. Subscribe to publish.
          </p>
        </div>
      </section>

      {/* Preview card */}
      <section className="relative pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="mb-4 text-center text-sm text-ink-medium">
            What lands in your dashboard every Sunday
          </p>
          <div className="overflow-hidden rounded-xl border border-ink-lighter bg-canvas shadow-card">
            <div className="flex items-center gap-1.5 border-b border-ink-lighter px-5 py-3">
              <span className="size-2.5 rounded-full bg-ink-light" />
              <span className="size-2.5 rounded-full bg-ink-light" />
              <span className="size-2.5 rounded-full bg-ink-light" />
              <span className="ml-4 font-mono text-xs text-ink-medium">
                Weekly Draft — Apr 14
              </span>
            </div>
            <div className="space-y-5 p-6 sm:p-8">
              <p className="text-[15px] leading-relaxed">
                Big week. Someone finally shipped the CLI tool they&apos;ve been
                building for six months, the auth debate in #backend went three
                days straight, and a quiet member&apos;s side project hit the
                front page of Hacker News.
              </p>
              <div className="border-l-2 border-accent-7 pl-5 py-1">
                <p className="text-sm font-semibold">
                  ## The tool that broke the star counter
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-dark">
                  One link in #show-work. Within an hour: 40 replies, 200 GitHub
                  stars, and three members asking to contribute.
                </p>
              </div>
              <div className="border-l-2 border-ink-light pl-5 py-1">
                <p className="text-sm font-semibold">
                  ## The great monorepo debate
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-dark">
                  It started with a simple question. Two hours and 80 messages
                  later, someone posted a diagram that actually changed minds.
                </p>
              </div>
              <p className="text-sm italic text-ink-medium">
                *Next week: community hackathon kicks off Friday.*
              </p>
            </div>
            <div className="flex items-center gap-6 border-t border-ink-lighter px-6 py-3 text-xs text-ink-medium sm:px-8">
              <span>
                <span className="font-semibold tabular-nums text-ink">1,247</span>{" "}
                messages read
              </span>
              <span>
                <span className="font-semibold tabular-nums text-ink">6</span>{" "}
                stories found
              </span>
              <span className="hidden sm:inline">
                <span className="font-semibold tabular-nums text-ink">~10 min</span>{" "}
                to edit & publish
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              You&apos;ve already done the hard part.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm text-ink-dark sm:text-base">
              Your community creates the content. Distill writes it up. You make
              it yours and hit publish.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: MessageSquare,
                n: "1",
                title: "Point it at your server",
                desc: "Add the Distill bot and choose channels to watch. Two minutes.",
                accent: "bg-accent-7",
              },
              {
                icon: Zap,
                n: "2",
                title: "A draft appears every Sunday",
                desc: "Distill reads the week's conversations, finds the best moments, and writes them up.",
                accent: "bg-accent-5",
              },
              {
                icon: Send,
                n: "3",
                title: "Make it yours and publish",
                desc: "Edit in markdown. Add your voice. Push to your newsletter platform.",
                accent: "bg-accent-2",
              },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-xl border border-ink-lighter bg-canvas p-6 shadow-card"
              >
                <span
                  className={cn(
                    "mb-5 inline-flex size-8 items-center justify-center rounded-pill text-xs font-bold text-ink-inverted",
                    step.accent,
                  )}
                >
                  {step.n}
                </span>
                <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-ink-dark">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Everything between Discord and &quot;send.&quot;
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Zap, title: "Finds stories that matter", desc: "Not a summary. Wins, debates, launches — moments readers actually care about." },
              { icon: Plug, title: "Publishes where you already are", desc: "One click to Beehiiv, ConvertKit, or Ghost. No copy-pasting between tabs." },
              { icon: Shield, title: "Respects your members", desc: "Anyone can /distill optout. Their messages are never read or included." },
              { icon: Target, title: "Only watches what you tell it to", desc: "Pick the channels that matter. Announcements and support stay out." },
              { icon: PenLine, title: "Always sounds like you", desc: "The draft is markdown you can edit. Cut what doesn't fit, add your take." },
              { icon: Clock, title: "Weekly, without asking", desc: "Set it once. A new draft lands every Sunday. You don't need to remember." },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-ink-lighter bg-canvas p-6 shadow-card transition-colors hover:bg-ink-lightest/40"
              >
                <div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-accent-6/15">
                  <f.icon className="size-4 text-accent-6" strokeWidth={1.6} />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-ink-dark">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Try it free. Pay when it&apos;s saving you time.
            </h2>
            <p className="mt-4 text-sm text-ink-dark sm:text-base">
              Cancel anytime.
            </p>
          </div>

          <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
            {/* Free */}
            <div className="flex flex-col rounded-xl border border-ink-lighter bg-canvas p-7 shadow-card">
              <h3 className="mb-1 text-lg font-bold">Free</h3>
              <p className="mb-6 text-sm text-ink-dark">
                Try Distill on your own Discord. No card needed.
              </p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tabular-nums">$0</span>
                <span className="text-sm text-ink-medium">/forever</span>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-ink-dark">
                    <Tick />
                    {f}
                  </li>
                ))}
              </ul>
              <form action={signInWithDiscord} className="w-full">
                <Button variant="outline" className="w-full">Start free</Button>
              </form>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col rounded-xl border-2 border-accent-7 bg-canvas p-7 shadow-card">
              <div className="absolute -top-3 left-7">
                <span className="rounded-pill bg-accent-7 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-inverted">
                  Recommended
                </span>
              </div>
              <h3 className="mb-1 text-lg font-bold">Pro</h3>
              <p className="mb-6 text-sm text-ink-dark">
                Weekly drafts on autopilot. Publish to your newsletter platform.
              </p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tabular-nums">$49</span>
                <span className="text-sm text-ink-medium">/mo</span>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-ink-dark">
                    <Tick />
                    {f}
                  </li>
                ))}
              </ul>
              <form action={signInWithDiscord} className="w-full">
                <Button variant="primary" className="w-full rounded-pill">
                  Get started
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative py-20">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-ink-lighter bg-canvas shadow-card"
              >
                <summary className="flex cursor-pointer select-none list-none items-center justify-between px-5 py-4 text-sm font-medium">
                  {faq.q}
                  <span className="ml-4 shrink-0 text-lg leading-none text-ink-medium transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="px-5 pb-4 text-sm leading-relaxed text-ink-dark">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="mb-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            You built a community people love.
            <br />
            <span className="text-ink-medium">Let the rest of the world see it.</span>
          </h2>
          <p className="mb-8 text-sm text-ink-dark sm:text-base">
            Generate your first draft free. Your members already did the work.
          </p>
          <form action={signInWithDiscord}>
            <Button variant="primary" size="lg" className="rounded-pill px-7">
              Try free with Discord
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </form>
        </div>
      </section>

      <footer className="relative border-t border-ink-lighter">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <span className="relative inline-flex h-6 w-6 items-center justify-center">
              <span aria-hidden className="absolute inset-0 rounded-[40%_60%_55%_45%/_50%_55%_45%_50%] bg-accent-7" />
              <span aria-hidden className="absolute inset-1 rounded-[55%_45%_60%_40%/_45%_55%_50%_50%] bg-accent-5/80" />
            </span>
            distill
          </span>
          <div className="flex items-center gap-6 text-xs text-ink-medium">
            <span>Beehiiv</span>
            <span>ConvertKit</span>
            <span>Ghost</span>
          </div>
          <span className="text-xs text-ink-medium">© 2026 SisleLabs</span>
        </div>
      </footer>
    </div>
  );
}
