import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

interface LegalPageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return { title: t("title"), description: t("intro") };
}

export default async function TermsPage({ params }: LegalPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "terms" });
  return <LegalDocument title={t("title")} updated={t("updated")} sections={[
    [t("serviceTitle"), t("serviceBody")],
    [t("useTitle"), t("useBody")],
    [t("weatherTitle"), t("weatherBody")],
    [t("rightsTitle"), t("rightsBody")],
    [t("liabilityTitle"), t("liabilityBody")],
    [t("changesTitle"), t("changesBody")],
    [t("contactTitle"), <>{t("contactBody")} <a className="underline" href="https://kristaps.me/" target="_blank" rel="noopener noreferrer">kristaps.me</a>.</>],
  ]} />;
}

function LegalDocument({ title, updated, sections }: { title: string; updated: string; sections: [string, ReactNode][] }) {
  return <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16"><Link href="/" className="text-sm font-medium text-sky-700 underline dark:text-sky-300">← Latvia Weather</Link><article className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:p-9"><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{updated}</p><div className="mt-8 space-y-7 text-sm leading-6 text-slate-700 dark:text-slate-300">{sections.map(([heading, body]) => <section key={heading}><h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{heading}</h2><p className="mt-2">{body}</p></section>)}</div></article></main>;
}
