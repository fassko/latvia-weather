import type { ReactNode } from "react";

interface ForecastErrorProps {
  message: string;
  action?: ReactNode;
}

export function ForecastError({ message, action }: ForecastErrorProps) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Unable to load forecast</h1>
      <p className="max-w-md text-slate-600 dark:text-slate-400">{message}</p>
      {action ?? (
        <a
          href="/"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          Try again
        </a>
      )}
    </main>
  );
}
