import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin");
  }

  // Cast to get our custom fields
  const s = session as typeof session & {
    userId: string;
    subscriptionStatus: string;
    trialEndsAt: string;
  };

  const isTrialExpired =
    s.subscriptionStatus === "trialing" &&
    new Date(s.trialEndsAt) < new Date();

  const trialDaysLeft =
    s.subscriptionStatus === "trialing" && !isTrialExpired
      ? Math.ceil(
          (new Date(s.trialEndsAt).getTime() - Date.now()) / 86400000
        )
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" className="text-xl font-bold">
          Distill
        </a>
        <div className="flex items-center gap-4">
          {trialDaysLeft !== null && (
            <span className="text-sm text-orange-600 font-medium">
              Trial: {trialDaysLeft} days left
            </span>
          )}
          <span className="text-sm text-gray-600">{session.user?.name}</span>
        </div>
      </nav>
      {isTrialExpired && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-center text-red-800">
          Your trial has ended. Subscribe to continue using Distill.
        </div>
      )}
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
