import { getTranslations } from "next-intl/server";
import { getConditionEmoji, getConditionKey } from "@/lib/weather/parse";

interface ConditionEmojiServerProps {
  iconCode: string;
  className?: string;
}

export async function ConditionEmojiServer({
  iconCode,
  className,
}: ConditionEmojiServerProps) {
  const t = await getTranslations("conditions");

  return (
    <>
      <span className={className} aria-hidden="true">
        {getConditionEmoji(iconCode)}
      </span>
      <span className="sr-only">{t(getConditionKey(iconCode))}</span>
    </>
  );
}
