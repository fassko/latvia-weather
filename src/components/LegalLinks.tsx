"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { openCookieSettings } from "@/components/CookieConsent";

export function LegalLinks() {
  const t = useTranslations("footer");
  return <span className="whitespace-nowrap"><Link href="/terms" className="underline hover:text-slate-700 dark:hover:text-slate-200">{t("terms")}</Link>{" · "}<Link href="/privacy" className="underline hover:text-slate-700 dark:hover:text-slate-200">{t("privacy")}</Link>{" · "}<button type="button" onClick={openCookieSettings} className="underline hover:text-slate-700 dark:hover:text-slate-200">{t("cookieSettings")}</button></span>;
}
