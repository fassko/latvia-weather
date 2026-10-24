import { format, parse, startOfHour, type FormatOptions, type Locale } from "date-fns";
import { getDateFnsLocale, getDatePattern, type DatePatternKey } from "@/lib/date-locale";

export const LATVIA_TIME_ZONE = "Europe/Riga";
const HOUR_MS = 60 * 60 * 1000;

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function getWallClockParts(date: Date, timeZone: string): WallClockParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** LVĢMC `laiks` uses the start of the current hour in Latvia local time. */
export function formatLaiks(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: LATVIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}${parts.month}${parts.day}${hour}00`;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getWallClockParts(date, timeZone);
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) -
    date.getTime()
  ) / 60_000;
}

function zonedTimeToUtcCandidates(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = LATVIA_TIME_ZONE,
): Date[] {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const probes = [
    wallClockAsUtc - 24 * HOUR_MS,
    wallClockAsUtc,
    wallClockAsUtc + 24 * HOUR_MS,
    Date.UTC(year, 0, 1, 12),
    Date.UTC(year, 6, 1, 12),
  ];
  const offsets = new Set(
    probes.map((probe) => getTimeZoneOffsetMinutes(new Date(probe), timeZone)),
  );

  return [...offsets]
    .map((offset) => new Date(wallClockAsUtc - offset * 60_000))
    .filter((candidate) => {
      const parts = getWallClockParts(candidate, timeZone);
      return parts.year === year &&
        parts.month === month &&
        parts.day === day &&
        parts.hour === hour &&
        parts.minute === minute;
    })
    .sort((a, b) => a.getTime() - b.getTime());
}

/** Parse LVĢMC `laiks` (yyyyMMddHHmm) as Europe/Riga local wall time. */
export function parseLaiks(laiks: string): Date {
  const candidates = parseLaiksCandidates(laiks);
  if (candidates[0]) return candidates[0];

  throw new RangeError(`Invalid Europe/Riga wall-clock time: ${laiks}`);
}

/** Return both instants when a Latvia wall-clock hour repeats at DST fallback. */
export function parseLaiksCandidates(laiks: string): Date[] {
  return zonedTimeToUtcCandidates(
    Number(laiks.slice(0, 4)),
    Number(laiks.slice(4, 6)),
    Number(laiks.slice(6, 8)),
    Number(laiks.slice(8, 10)),
    Number(laiks.slice(10, 12)),
  );
}

/** Add real elapsed forecast hours, independent of the runtime's local timezone. */
export function addForecastHours(date: Date, offsetHours: number): Date {
  const startOfAbsoluteHour = Math.floor(date.getTime() / HOUR_MS) * HOUR_MS;
  return new Date(startOfAbsoluteHour + offsetHours * HOUR_MS);
}

/** Find the next Latvia calendar midnight, including 23/25-hour DST days. */
export function getNextLatviaMidnight(now: Date): Date {
  const [year, month, day] = getLatviaDayKey(now).split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDayKey = nextDay.toISOString().slice(0, 10).replaceAll("-", "");
  return parseLaiks(`${nextDayKey}0000`);
}

/** Map an instant to Latvia wall-clock fields for date-fns formatting. */
export function getLatviaWallClock(date: Date): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: LATVIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const hour = parts.hour === "24" ? "00" : parts.hour;

  return parse(
    `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`,
    "yyyy-MM-dd HH:mm",
    new Date(),
  );
}

export function getLatviaStartOfHour(date: Date): Date {
  return startOfHour(getLatviaWallClock(date));
}

export function getLatviaDayKey(date: Date): string {
  return format(getLatviaWallClock(date), "yyyy-MM-dd");
}

export function formatLatviaTime(
  date: Date,
  pattern: string,
  options?: FormatOptions & { locale?: Locale },
): string {
  return format(getLatviaWallClock(date), pattern, options);
}

export function formatLatviaDateTime(
  date: Date,
  locale: string,
  patternKey: DatePatternKey,
): string {
  return format(getLatviaWallClock(date), getDatePattern(locale, patternKey), {
    locale: getDateFnsLocale(locale),
  });
}
