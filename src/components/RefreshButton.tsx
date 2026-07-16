"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshButton() {
  const t = useTranslations("refresh");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      aria-label={isPending ? t("refreshing") : t("label")}
      title={isPending ? t("refreshing") : t("label")}
      aria-busy={isPending}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none disabled:cursor-wait dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-sky-600 dark:hover:text-sky-300"
    >
      <RefreshIcon spinning={isPending} />
    </button>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h1.653a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v3.16a.75.75 0 0 0 1.5 0v-1.353l.311.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.384Zm1.23-3.723a.75.75 0 0 0 .219-.53V4.01a.75.75 0 0 0-1.5 0v1.352l-.311-.31A7 7 0 0 0 3.239 8.19a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.311h-1.653a.75.75 0 0 0 0 1.5h3.16a.75.75 0 0 0 .53-.22Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
