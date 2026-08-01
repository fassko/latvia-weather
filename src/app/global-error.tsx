"use client";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  // Internal failure details help nobody in production and can leak
  // implementation detail, so only the digest is shown there.
  const details =
    process.env.NODE_ENV === "production"
      ? error.digest
        ? `Reference: ${error.digest}`
        : "Please try again in a moment."
      : error.message;

  return (
    <html lang="en">
      <body className="min-h-full bg-sky-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="max-w-md text-slate-600 dark:text-slate-400">{details}</p>
          <button
            type="button"
            onClick={unstable_retry}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
