/** An em dash distinguishes unavailable forecast data from a measured zero. */
export function formatOptionalPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}
