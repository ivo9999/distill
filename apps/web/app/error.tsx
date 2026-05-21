"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root error boundary]", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-black tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-medium">
          An unexpected error occurred. Please try again — if it keeps
          happening, get in touch.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
