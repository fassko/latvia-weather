import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SetHtmlLang } from "@/components/SetHtmlLang";
import { ThemeToggle } from "@/components/ThemeToggle";
import { routing, type Locale } from "@/i18n/routing";

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <SetHtmlLang />
      <div className="mx-auto flex w-full max-w-5xl justify-end gap-2 px-4 pt-4 sm:px-6">
        <Suspense fallback={null}>
          <LanguageSwitcher />
        </Suspense>
        <ThemeToggle />
      </div>
      {children}
    </NextIntlClientProvider>
  );
}
