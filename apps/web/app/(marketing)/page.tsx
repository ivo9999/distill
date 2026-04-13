import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Link from "next/link";

const steps = [
  {
    number: "1",
    title: "Connect your server",
    description:
      "Add the Distill bot to your Discord and pick which channels to watch.",
  },
  {
    number: "2",
    title: "Get a draft every Sunday",
    description:
      "Distill reads the week's conversations and writes a newsletter draft for you.",
  },
  {
    number: "3",
    title: "Edit and ship",
    description:
      "Review the draft, make it yours, and publish straight to your newsletter platform.",
  },
];

const features = [
  "Weekly AI-generated drafts",
  "Beehiiv / ConvertKit / Ghost publishing",
  "Discord opt-out for members",
  "Token usage tracking",
  "Email support",
];

const faqs = [
  {
    question: "Does it work with Substack?",
    answer:
      "No, Substack doesn't offer a public API. We support Beehiiv, ConvertKit, and Ghost.",
  },
  {
    question: "What about member privacy?",
    answer:
      "Members can opt out with /distill optout. Opted-out users' messages are never included.",
  },
  {
    question: "How accurate is the AI?",
    answer:
      "The draft is a starting point. You always review and edit before publishing.",
  },
  {
    question: "Why $49/month?",
    answer:
      "Each newsletter costs us real money in AI processing. $49/mo covers the cost and keeps us sustainable.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gray-950 text-white">
        <div className="max-w-5xl mx-auto px-6 py-24 md:py-32 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
            Your Discord wrote your
            <br />
            newsletter this week.
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Distill turns the best discussions in your community into a
            publishable draft, every Sunday. You hit edit, then publish —
            straight to Beehiiv, ConvertKit, or Ghost. Stop ghosting your email
            list.
          </p>
          <Link href="/api/auth/signin">
            <Button size="lg" className="text-base px-8 py-3 h-12">
              Start free for 14 days
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-950 text-white text-lg font-bold mb-4">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">Pricing</h2>
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Distill Pro</CardTitle>
                <CardDescription>
                  Everything you need to ship a weekly newsletter from your
                  Discord.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold">$49</span>
                  <span className="text-gray-500">/mo</span>
                  <p className="text-sm text-gray-500 mt-1">
                    14-day free trial &middot; no card required
                  </p>
                </div>
                <ul className="space-y-3 mb-8">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-green-600 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/api/auth/signin" className="block">
                  <Button className="w-full" size="lg">
                    Start free for 14 days
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">FAQ</h2>
          <div className="space-y-8">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="text-lg font-semibold mb-2">{faq.question}</h3>
                <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center text-sm">
          Built by SisleLabs in Sofia.
        </div>
      </footer>
    </div>
  );
}
