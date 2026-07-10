"use client";

import { useTranslations } from "next-intl";
import { getConditionEmoji, getConditionKey } from "@/lib/weather/parse";

interface ConditionEmojiProps {
  iconCode: string;
  className?: string;
}

export function ConditionEmoji({ iconCode, className }: ConditionEmojiProps) {
  const t = useTranslations("conditions");

  return (
    <>
      <span className={className} aria-hidden="true">
        {getConditionEmoji(iconCode)}
      </span>
      <span className="sr-only">{t(getConditionKey(iconCode))}</span>
    </>
  );
}
