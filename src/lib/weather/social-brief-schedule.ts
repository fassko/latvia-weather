import { DEFAULT_LOCATION_ID } from "./locations";
import { POPULAR_LOCATION_IDS } from "@/lib/seo/popular-locations";
import { getLatviaWallClock } from "./timezone";

export const SOCIAL_BRIEF_TIMEZONE = "Europe/Riga";

/** Named posting slots for social automation. */
export type SocialBriefSlotId =
  | "weekday_morning"
  | "friday_weekend_outlook"
  | "weekend_morning";

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
  angle: "commute" | "weekend_plan" | "weekend_day";
  /** UTM campaign suffix. */
  campaign: string;
  description: string;
}

const RIGA = DEFAULT_LOCATION_ID;
const LIEPAJA = "P770";
const JURMALA = "P768";

/** Primary automation slots (weekday vs weekend timing). */
export const SOCIAL_BRIEF_SLOTS: Record<SocialBriefSlotId, SocialBriefSlot> = {
  weekday_morning: {
    id: "weekday_morning",
    label: "Weekday morning brief",
    timezone: SOCIAL_BRIEF_TIMEZONE,
    daysOfWeek: [1, 2, 3, 4, 5],
    publishLocalTime: "07:00",
    localeDefault: "lv",
    locationIds: [RIGA, LIEPAJA],
    platforms: ["instagram", "tiktok"],
    conditionalPlatforms: ["facebook", "x"],
    interestingRainChance: 50,
    angle: "commute",
    campaign: "weekday_morning",
    description:
      "Mon–Fri ~07:00 Europe/Riga. Commute brief for Rīga + Liepāja. IG/TikTok always; FB/X when wet or windy.",
  },
  friday_weekend_outlook: {
    id: "friday_weekend_outlook",
    label: "Friday weekend outlook",
    timezone: SOCIAL_BRIEF_TIMEZONE,
    daysOfWeek: [5],
    publishLocalTime: "16:00",
    localeDefault: "lv",
    locationIds: [RIGA, LIEPAJA, JURMALA],
    platforms: ["instagram", "tiktok", "facebook"],
    conditionalPlatforms: ["x"],
    interestingRainChance: 40,
    angle: "weekend_plan",
    campaign: "weekend_outlook",
    description:
      "Friday 16:00 Europe/Riga. Weekend planning clip for Rīga, Liepāja, Jūrmala. Prefer compare / outing hooks.",
  },
  weekend_morning: {
    id: "weekend_morning",
    label: "Weekend morning brief",
    timezone: SOCIAL_BRIEF_TIMEZONE,
    daysOfWeek: [0, 6],
    publishLocalTime: "09:00",
    localeDefault: "lv",
    locationIds: [RIGA, JURMALA, LIEPAJA],
    platforms: ["instagram", "tiktok"],
    conditionalPlatforms: ["facebook", "x"],
    interestingRainChance: 50,
    angle: "weekend_day",
    campaign: "weekend_morning",
    description:
      "Sat–Sun 09:00 Europe/Riga. Later morning brief with activity-oriented captions.",
  },
};

export const SOCIAL_BRIEF_SLOT_IDS = Object.keys(
  SOCIAL_BRIEF_SLOTS,
) as SocialBriefSlotId[];

export function isSocialBriefSlotId(value: string): value is SocialBriefSlotId {
  return value in SOCIAL_BRIEF_SLOTS;
}

export function resolveSocialBriefSlot(
  value: string | null | undefined,
): SocialBriefSlot {
  if (value && isSocialBriefSlotId(value)) {
    return SOCIAL_BRIEF_SLOTS[value];
  }
  return SOCIAL_BRIEF_SLOTS.weekday_morning;
}

/** Pick the slot that matches Latvia's current weekday, else weekday_morning. */
export function inferSocialBriefSlot(now = new Date()): SocialBriefSlot {
  const local = getLatviaWallClock(now);
  const day = local.getDay();
  const hour = local.getHours();

  if (day === 5 && hour >= 14) {
    return SOCIAL_BRIEF_SLOTS.friday_weekend_outlook;
  }
  if (day === 0 || day === 6) {
    return SOCIAL_BRIEF_SLOTS.weekend_morning;
  }
  return SOCIAL_BRIEF_SLOTS.weekday_morning;
}

export function listSocialBriefSchedule() {
  return {
    timezone: SOCIAL_BRIEF_TIMEZONE,
    slots: SOCIAL_BRIEF_SLOT_IDS.map((id) => SOCIAL_BRIEF_SLOTS[id]),
    seedLocationIds: POPULAR_LOCATION_IDS.slice(0, 6),
  };
}
