const LETTER_CLASS = "A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž";

/**
 * Whole-word weekend tokens for the AI assistant.
 * Full names match any casing; Sat/Sun abbreviations require a capital S
 * so words like "sunny" and "sun" are not highlighted.
 *
 * Do not use the `i` flag — it would make Sat/Sun match lowercase "sun".
 */
const WEEKEND_DAY_SPLIT = new RegExp(
  `(?<![${LETTER_CLASS}])(` +
    `[Ss]aturday|[Ss]unday|` +
    `[Ss]estdien[aāu]?|[Ss]vētdien[aāu]?|` +
    `SATURDAY|SUNDAY|SESTDIEN[AĀU]?|SVĒTDIEN[AĀU]?|` +
    `Sat\\.?|Sun\\.?|SAT\\.?|SUN\\.?` +
    `)(?![${LETTER_CLASS}])`,
  "g",
);

const FULL_WEEKEND_DAY =
  /^(saturday|sunday|sestdien[aāu]?|svētdien[aāu]?)$/i;
const WEEKEND_DAY_ABBREVIATION = /^(Sat|Sun|SAT|SUN)\.?$/;

export function isWeekendDayToken(text: string): boolean {
  return FULL_WEEKEND_DAY.test(text) || WEEKEND_DAY_ABBREVIATION.test(text);
}

export function splitWeekendDayParts(text: string): string[] {
  // Recreate so the sticky lastIndex from the /g flag cannot leak across calls.
  const pattern = new RegExp(WEEKEND_DAY_SPLIT.source, WEEKEND_DAY_SPLIT.flags);
  return text.split(pattern).filter(Boolean);
}
