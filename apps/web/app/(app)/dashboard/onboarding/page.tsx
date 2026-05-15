import { OnboardingClient } from "./onboarding-client";

/* -----------------------------------------------------------------------
   Onboarding shell — server-rendered.

   Why this is a server component (not "use client"):

   The previous version read NEXT_PUBLIC_DISCORD_CLIENT_ID directly in a
   `"use client"` page, which means Next.js inlines the value into the
   JavaScript bundle at build time. Kuso's kaniko build for the
   dockerfile strategy doesn't forward service env vars as build-args,
   so the build captured `undefined` and shipped a Discord OAuth URL
   with `client_id=undefined` — Discord then rejected it with
   "Value undefined is not snowflake."

   Reading DISCORD_CLIENT_ID server-side at request time sidesteps the
   whole NEXT_PUBLIC_ build-inlining dance. The value comes from the
   runtime env, which kuso populates correctly via Secrets. We pass
   the fully-formed URL to the client subcomponent as a prop.

   Required Discord OAuth permissions (274877925376) =
     - View Channels
     - Send Messages
     - Read Message History
     - Use Application Commands
     - Embed Links
   Scope = `bot applications.commands`. Same permissions the bot uses
   to run /distill optout and watch monitored channels.
   --------------------------------------------------------------------- */

export default function OnboardingPage() {
  // Prefer the non-public secret because that's authoritative on every
  // service in this project; fall back to NEXT_PUBLIC_* for back-compat
  // with any deploy that only has the public var wired. Empty string
  // produces a visibly-bad URL ("client_id=") so problems surface in
  // dev rather than getting masked by string concatenation.
  const clientId =
    process.env.DISCORD_CLIENT_ID ||
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ||
    "";

  const discordBotUrl =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&permissions=274877925376` +
    `&scope=bot+applications.commands`;

  return <OnboardingClient discordBotUrl={discordBotUrl} />;
}
