import { WeatherWarningsClient } from "@/components/WeatherWarningsClient";
import type { WeatherWarning } from "@/lib/weather/types";
import { getDismissedWarningIds } from "@/lib/weather/warning-dismiss-cookie.server";

interface WeatherWarningsProps {
  locale: string;
  warnings: WeatherWarning[];
}

export async function WeatherWarnings({ locale, warnings }: WeatherWarningsProps) {
  if (warnings.length === 0) return null;

  const initialDismissedIds = await getDismissedWarningIds();

  return (
    <WeatherWarningsClient
      locale={locale}
      warnings={warnings}
      initialDismissedIds={initialDismissedIds}
    />
  );
}
