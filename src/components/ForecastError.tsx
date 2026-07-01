"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppToolbar } from "@/components/AppToolbar";
import { Link } from "@/i18n/navigation";

interface ForecastErrorProps {
  message: string;
  action?: ReactNode;
}

export function ForecastError({ message, action }: ForecastErrorProps) {
  const t = useTranslations("errors");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex justify-end">
        <AppToolbar />
      </div>
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t("loadForecast")}
        </h1>
        <p className="max-w-md text-slate-600 dark:text-slate-400">{message}</p>
        {action ?? (
          <Link
            href="/"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            {t("tryAgain")}
          </Link>
        )}
      </div>
    </main>
  );
}
