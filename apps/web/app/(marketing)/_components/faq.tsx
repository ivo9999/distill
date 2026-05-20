"use client";

import { useState } from "react";

const faqs = [
  {
    q: "I've tried newsletter tools before. They didn't sound like me. Why is this different?",
    a: "Because we don't write the email — your community does. The draft is built from what people in your Discord actually said this week. The voice is theirs (paraphrased, anonymized), threaded through a short prose structure. You then spend ten minutes editing in your own voice. Most creators report it sounds like them on the second send.",
  },
  {
    q: "What if nothing interesting happens in my Discord this week?",
    a: "Then we won't fake it. The writer is tuned to cut weak material. A slow week produces a short, honest email — 'here's the one good thread, see you next week' — not a forced thousand words. The worst output is a draft you choose not to send. The cost is zero either way.",
  },
  {
    q: "Who actually reads my members' messages? Where do they go?",
    a: "The bot reads only the channels you point it at. Messages flow through a two-stage writer that paraphrases everything and anonymizes by default — nobody's name appears in the draft unless you put it there. Raw messages are deleted after the draft is generated. Anyone in your Discord can type /distill optout and their words are permanently excluded.",
  },
  {
    q: "Can I trust an editor to write my emails?",
    a: "You're trusting it for the first draft, not the final send. You're still the one hitting publish. The product makes the empty page go away. The 'is this me' check is still yours. Most users edit 15-30% of the draft on a typical week and ship the rest as-is.",
  },
  {
    q: "What platforms does it publish to?",
    a: "Beehiiv, ConvertKit, and Ghost — one click each, you set up the API key once. Substack doesn't expose a public API; the moment they do, we'll be there. If you publish somewhere else, the markdown is yours to copy-paste anywhere.",
  },
  {
    q: "Is the free draft really free? What's the catch?",
    a: "One draft per Discord server, ever. We key it on the guild ID, so new accounts or re-adding the bot don't reset it. The catch is honest: it's a one-shot taste of the product. If it nails your voice, you'll know on draft one. If it doesn't, we don't deserve $49 a month from you.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="border-t border-ink-lighter/60 px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="mx-auto max-w-[920px]">
        <p className="font-mono text-[13px] tracking-wider text-brand sm:text-[14px]">
          {"// the things you'd ask before you'd sign up"}
        </p>

        <h2 className="mt-6 text-[clamp(28px,4.2vw,48px)] font-black leading-[1.1] tracking-tight">
          Six honest answers.
        </h2>

        <div className="mt-12 rounded-card border border-ink-lighter bg-canvas">
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-b border-ink-lighter last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="group flex w-full cursor-pointer items-start justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-[15px] font-semibold leading-snug text-ink-darker sm:text-[17px]">
                    {faq.q}
                  </span>
                  <span
                    className={`mt-1 inline-flex size-5 shrink-0 items-center justify-center text-ink-medium transition-transform duration-200 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                    aria-hidden
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-200 ease-in-out"
                  style={{
                    maxHeight: isOpen ? "400px" : "0",
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <p className="pb-5 pr-10 pl-6 text-[14px] leading-relaxed text-ink-medium sm:text-[16px]">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
