import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LegalLinks } from "@/components/LegalLinks";
import {
  buildLanguageAlternates,
  buildLocalePageUrl,
} from "@/lib/seo/alternates";
import { getSiteUrl } from "@/lib/site";

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  const tMetadata = await getTranslations({ locale, namespace: "metadata" });
  const title = `${t("title")} — ${tMetadata("siteTitle")}`;
  const description = t("intro");
  const pageUrl = buildLocalePageUrl(locale, "/about");

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
      languages: buildLanguageAlternates("/about"),
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: tMetadata("siteTitle"),
      locale: locale === "lv" ? "lv_LV" : "en_US",
      type: "website",
    },
  };
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });
  const tMetadata = await getTranslations({ locale, namespace: "metadata" });
  const pageUrl = buildLocalePageUrl(locale, "/about");

  const sections: [string, string][] = [
    [t("sourceTitle"), t("sourceBody")],
    [t("warningsTitle"), t("warningsBody")],
    [t("climateTitle"), t("climateBody")],
    [t("mapTitle"), t("mapBody")],
    [t("assistantTitle"), t("assistantBody")],
  ];

  const faqs = [
    { question: t("faq.q1"), answer: t("faq.a1") },
    { question: t("faq.q2"), answer: t("faq.a2") },
    { question: t("faq.q3"), answer: t("faq.a3") },
    { question: t("faq.q4"), answer: t("faq.a4") },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${t("title")} — ${tMetadata("siteTitle")}`,
    description: t("intro"),
    url: pageUrl,
    isPartOf: { "@id": `${getSiteUrl()}/#website` },
    inLanguage: locale === "lv" ? "lv-LV" : "en-US",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="text-sm font-medium text-sky-700 underline dark:text-sky-300"
        >
          ← {tMetadata("siteTitle")}
        </Link>
        <article className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:p-9">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t("updated")}
          </p>
          <p className="mt-6 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {t("intro")}
          </p>
          <div className="mt-8 space-y-7 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {sections.map(([heading, body]) => (
              <section key={heading}>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {heading}
                </h2>
                <p className="mt-2">{body}</p>
              </section>
            ))}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t("faqTitle")}
              </h2>
              <dl className="mt-4 space-y-4">
                {faqs.map((faq) => (
                  <div key={faq.question}>
                    <dt className="font-semibold text-slate-900 dark:text-slate-100">
                      {faq.question}
                    </dt>
                    <dd className="mt-1">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            <Link href="/map" className="font-medium text-sky-700 underline dark:text-sky-300">
              {t("mapTitle")}
            </Link>
            {" · "}
            <LegalLinks />
          </p>
        </article>
      </main>
    </>
  );
}
