/** Shared between the assistant API and its UI fallback so both stay in sync. */
export function getSourceCaption(locationName: string, locale: string): string {
  if (locale === "lv") {
    return `Balstīts uz šīs lietotnes LVĢMC prognozi — ${locationName}.`;
  }

  return `Based on this app’s LVGMC forecast — ${locationName}.`;
}
