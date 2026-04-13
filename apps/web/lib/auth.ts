import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { pool } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "identify email guilds",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider !== "discord") return false;

      const discordId = account.providerAccountId;
      const username = (profile as Record<string, unknown>)?.username as string ?? user.name ?? "unknown";
      const email = user.email ?? "";
      const avatar = user.image ?? null;

      await pool.query(
        `INSERT INTO users (discord_id, discord_username, email, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (discord_id) DO UPDATE SET
           discord_username = EXCLUDED.discord_username,
           email = EXCLUDED.email,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = NOW()
         RETURNING id, subscription_status, trial_ends_at`,
        [discordId, username, email, avatar]
      );

      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.discordId = account.providerAccountId;

        const result = await pool.query(
          "SELECT id, subscription_status, trial_ends_at FROM users WHERE discord_id = $1",
          [account.providerAccountId]
        );
        if (result.rows.length > 0) {
          token.userId = result.rows[0].id;
          token.subscriptionStatus = result.rows[0].subscription_status;
          token.trialEndsAt = result.rows[0].trial_ends_at;
        }

        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        userId: token.userId as string,
        discordId: token.discordId as string,
        subscriptionStatus: token.subscriptionStatus as string,
        trialEndsAt: token.trialEndsAt as string,
        accessToken: token.accessToken as string,
      };
    },
  },
  pages: {
    signIn: "/",
  },
});
