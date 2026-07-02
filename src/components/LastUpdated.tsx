import { formatDistanceToNow } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { getDateFnsLocale } from "@/lib/date-locale";

interface LastUpdatedProps {
  fetchedAt: Date;
}

export async function LastUpdated({ fetchedAt }: LastUpdatedProps) {
  const locale = await getLocale();
  const t = await getTranslations("footer");
  const dateLocale = getDateFnsLocale(locale);
  const relative = formatDistanceToNow(fetchedAt, { addSuffix: true, locale: dateLocale });

  return (
    <span>
      {t("lastUpdated", { time: relative })}
    </span>
  );
}
