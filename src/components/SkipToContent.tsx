import { getTranslations } from "next-intl/server";

export const MAIN_CONTENT_ID = "main-content";

/** Lets keyboard users jump past the sticky header and its toolbar controls. */
export async function SkipToContent() {
  const t = await getTranslations("nav");

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-sky-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none"
    >
      {t("skipToContent")}
    </a>
  );
}
