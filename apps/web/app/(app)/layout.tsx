import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SubscribeBanner } from "./subscribe-banner";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin");
  }

  const s = session as typeof session & {
    userId: string;
    subscriptionStatus: string;
  };

  const isActive = s.subscriptionStatus === "active";

  return (
    <DashboardShell
      user={{
        name: session.user?.name ?? "User",
        email: session.user?.email,
        image: session.user?.image,
        subscriptionStatus: s.subscriptionStatus,
      }}
    >
      {!isActive && <SubscribeBanner subscriptionStatus={s.subscriptionStatus} />}
      {children}
    </DashboardShell>
  );
}
