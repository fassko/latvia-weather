import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("refresh");

  return (
    <main
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{t("loadingForecast")}</span>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-72 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-48 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800 md:h-[400px]" />
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 w-20 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    </main>
  );
}
