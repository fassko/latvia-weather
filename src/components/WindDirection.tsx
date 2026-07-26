"use client";

import { useTranslations } from "next-intl";
import { getWindDirection } from "@/lib/weather/parse";

interface WindDirectionProps {
  degrees: number;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const sizeClassNames = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
} as const;

export function WindDirection({
  degrees,
  showLabel = true,
  size = "md",
  className,
}: WindDirectionProps) {
  const t = useTranslations("wind");
  const label = t(`directions.${getWindDirection(degrees)}`);

  return (
    <span
      className={`inline-flex items-center gap-1 ${className ?? ""}`}
      title={t("from", { direction: label })}
    >
      <svg
        aria-hidden="true"
        className={`shrink-0 ${sizeClassNames[size]}`}
        style={{ transform: `rotate(${degrees + 180}deg)` }}
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          d="M8 2v10M8 2L5 7M8 2l3 5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}
