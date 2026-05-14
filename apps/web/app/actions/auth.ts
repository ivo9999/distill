"use server";

import { signIn } from "@/lib/auth";

export async function signInWithDiscord() {
  await signIn("discord", { redirectTo: "/dashboard" });
}
