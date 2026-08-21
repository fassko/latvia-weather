import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LegalLinks } from "@/components/LegalLinks";

interface PrivacyPageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: t("title"), description: t("intro") };
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "privacy" });
  const sections: [string, string][] = [
    [t("controllerTitle"), t("controllerBody")], [t("dataTitle"), t("dataBody")],
    [t("purposeTitle"), t("purposeBody")], [t("cookiesTitle"), t("cookiesBody")],
    [t("analyticsTitle"), t("analyticsBody")], [t("retentionTitle"), t("retentionBody")],
    [t("rightsTitle"), t("rightsBody")], [t("changesTitle"), t("changesBody")],
  ];
  return <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16"><Link href="/" className="text-sm font-medium text-sky-700 underline dark:text-sky-300">← Latvia Weather</Link><article className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:p-9"><h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("updated")}</p><p className="mt-6 text-sm leading-6 text-slate-700 dark:text-slate-300">{t("intro")}</p><div className="mt-8 space-y-7 text-sm leading-6 text-slate-700 dark:text-slate-300">{sections.map(([heading, body]) => <section key={heading}><h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{heading}</h2><p className="mt-2">{body}</p></section>)}</div><div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-700"><LegalLinks /></div></article></main>;
}
