import { format, parse, startOfHour, type FormatOptions, type Locale } from "date-fns";
import { getDateFnsLocale, getDatePattern, type DatePatternKey } from "@/lib/date-locale";

export const LATVIA_TIME_ZONE = "Europe/Riga";

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = LATVIA_TIME_ZONE,
): Date {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(utcDate);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
  );

  return new Date(utcDate.getTime() + (utcDate.getTime() - asUtc));
}

/** Parse LVĢMC `laiks` (yyyyMMddHHmm) as Europe/Riga local wall time. */
export function parseLaiks(laiks: string): Date {
  return zonedTimeToUtc(
    Number(laiks.slice(0, 4)),
    Number(laiks.slice(4, 6)),
    Number(laiks.slice(6, 8)),
    Number(laiks.slice(8, 10)),
    Number(laiks.slice(10, 12)),
  );
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
