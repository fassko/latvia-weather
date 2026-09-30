import { DEFAULT_LOCATION_ID } from "./locations";
import { POPULAR_LOCATION_IDS } from "@/lib/seo/popular-locations";
import { getLatviaWallClock } from "./timezone";

export const SOCIAL_BRIEF_TIMEZONE = "Europe/Riga";

/** Named posting slots for social automation. */
export type SocialBriefSlotId =
  | "weekday_evening"
  | "friday_weekend_outlook"
  | "weekend_evening";

export type SocialPlatform = "instagram" | "tiktok" | "facebook" | "x";

export interface SocialBriefSlot {
  id: SocialBriefSlotId;
  /** Human label for ops. */
  label: string;
  timezone: typeof SOCIAL_BRIEF_TIMEZONE;
  /** Days this slot is intended for (0=Sun … 6=Sat, JS getDay). */
  daysOfWeek: number[];
  /** Local wall-clock hour:minute target for publishing. */
  publishLocalTime: string;
  localeDefault: "lv" | "en";
  /** Forecast point IDs to render for this slot. */
  locationIds: readonly string[];
  /** Always post to these platforms. */
  platforms: SocialPlatform[];
  /** Extra platforms when rain/interesting threshold hits. */
  conditionalPlatforms: SocialPlatform[];
  /** Rain-chance % that unlocks conditional platforms. */
  interestingRainChance: number;
  /** Caption / hook framing. */
  angle: "evening" | "weekend_plan" | "weekend_evening";
  /** UTM campaign suffix. */
  campaign: string;
  description: string;
}

/** Old morning slot ids still accepted on the API. */
const SLOT_ALIASES: Record<string, SocialBriefSlotId> = {
  weekday_morning: "weekday_evening",
  weekend_morning: "weekend_evening",
};

const RIGA = DEFAULT_LOCATION_ID;
const LIEPAJA = "P770";
const JURMALA = "P768";

/** Primary automation slots (weekday vs weekend evening timing). */
export const SOCIAL_BRIEF_SLOTS: Record<SocialBriefSlotId, SocialBriefSlot> = {
  weekday_evening: {
    id: "weekday_evening",
    label: "Weekday evening brief",
    timezone: SOCIAL_BRIEF_TIMEZONE,
    daysOfWeek: [1, 2, 3, 4],
    publishLocalTime: "18:30",
    localeDefault: "lv",
    locationIds: [RIGA, LIEPAJA],
    platforms: ["instagram", "tiktok"],
    conditionalPlatforms: ["facebook", "x"],
    interestingRainChance: 50,
    angle: "evening",
    campaign: "weekday_evening",
    description:
      "Mon–Thu ~18:30 Europe/Riga. Evening brief for tonight/tomorrow in Rīga + Liepāja. IG/TikTok always; FB/X when wet or windy.",
  },
  friday_weekend_outlook: {
    id: "friday_weekend_outlook",
    label: "Friday weekend outlook",
    timezone: SOCIAL_BRIEF_TIMEZONE,
    daysOfWeek: [5],
    publishLocalTime: "18:30",
    localeDefault: "lv",
    locationIds: [RIGA, LIEPAJA, JURMALA],
    platforms: ["instagram", "tiktok", "facebook"],
    conditionalPlatforms: ["x"],
    interestingRainChance: 40,
    angle: "weekend_plan",
    campaign: "weekend_outlook",
    description:
      "Friday 18:30 Europe/Riga. Weekend planning clip for Rīga, Liepāja, Jūrmala. Prefer compare / outing hooks.",
  },
  weekend_evening: {
    id: "weekend_evening",
    label: "Weekend evening brief",
    timezone: SOCIAL_BRIEF_TIMEZONE,
    daysOfWeek: [0, 6],
    publishLocalTime: "18:30",
    localeDefault: "lv",
    locationIds: [RIGA, JURMALA, LIEPAJA],
    platforms: ["instagram", "tiktok"],
    conditionalPlatforms: ["facebook", "x"],
    interestingRainChance: 50,
    angle: "weekend_evening",
    campaign: "weekend_evening",
    description:
      "Sat–Sun 18:30 Europe/Riga. Evening brief with tomorrow/outing-oriented captions.",
  },
};

export const SOCIAL_BRIEF_SLOT_IDS = Object.keys(
  SOCIAL_BRIEF_SLOTS,
) as SocialBriefSlotId[];

export function isSocialBriefSlotId(value: string): value is SocialBriefSlotId {
  return value in SOCIAL_BRIEF_SLOTS;
}

/** Accepts current slot ids and legacy morning aliases. */
export function normalizeSocialBriefSlotId(
  value: string,
): SocialBriefSlotId | undefined {
  const canonical = SLOT_ALIASES[value] ?? value;
  return isSocialBriefSlotId(canonical) ? canonical : undefined;
}

export function resolveSocialBriefSlot(
  value: string | null | undefined,
): SocialBriefSlot {
  if (value) {
    const resolved = normalizeSocialBriefSlotId(value);
    if (resolved) return SOCIAL_BRIEF_SLOTS[resolved];
  }
  return SOCIAL_BRIEF_SLOTS.weekday_evening;
}

/** Pick the slot that matches Latvia's current weekday, else weekday_evening. */
export function inferSocialBriefSlot(now = new Date()): SocialBriefSlot {
  const local = getLatviaWallClock(now);
  const day = local.getDay();

  if (day === 5) {
    return SOCIAL_BRIEF_SLOTS.friday_weekend_outlook;
  }
  if (day === 0 || day === 6) {
    return SOCIAL_BRIEF_SLOTS.weekend_evening;
  }
  return SOCIAL_BRIEF_SLOTS.weekday_evening;
}

export function listSocialBriefSchedule() {
  return {
    timezone: SOCIAL_BRIEF_TIMEZONE,
    slots: SOCIAL_BRIEF_SLOT_IDS.map((id) => SOCIAL_BRIEF_SLOTS[id]),
    seedLocationIds: POPULAR_LOCATION_IDS.slice(0, 6),
  };
}
