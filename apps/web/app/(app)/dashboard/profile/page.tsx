import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin");
  }

  const s = session as typeof session & {
    userId: string;
    subscriptionStatus: string;
  };

  return (
    <ProfileClient
      name={session.user?.name ?? "User"}
      email={session.user?.email ?? ""}
      avatar={session.user?.image ?? null}
      subscriptionStatus={s.subscriptionStatus}
    />
  );
}
