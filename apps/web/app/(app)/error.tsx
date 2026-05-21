"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-black tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-medium">
          We hit an unexpected error loading this page.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-ink-lighter px-5 py-2 text-sm font-semibold text-ink hover:bg-ink-lightest"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
