"use client";

import { ForecastError } from "@/components/ForecastError";

interface ErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function Error({ error, unstable_retry }: ErrorProps) {
  return (
    <ForecastError
      message={error.message}
      action={
        <button
          type="button"
          onClick={unstable_retry}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          Try again
        </button>
      }
    />
  );
}
