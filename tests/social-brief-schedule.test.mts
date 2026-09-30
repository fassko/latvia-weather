import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferSocialBriefSlot,
  isSocialBriefSlotId,
  listSocialBriefSchedule,
  normalizeSocialBriefSlotId,
  resolveSocialBriefSlot,
  SOCIAL_BRIEF_SLOTS,
} from "../src/lib/weather/social-brief-schedule.ts";
import { isSocialBriefAuthorized } from "../src/lib/weather/social-brief-auth.ts";
import { getUpcomingWeekendDayKeys } from "../src/lib/weather/hyperframes-daily-brief.ts";
import { parseLaiks } from "../src/lib/weather/timezone.ts";

describe("social brief schedule", () => {
  it("exposes three Europe/Riga evening slots", () => {
    const schedule = listSocialBriefSchedule();
    assert.equal(schedule.timezone, "Europe/Riga");
    assert.equal(schedule.slots.length, 3);
    assert.equal(SOCIAL_BRIEF_SLOTS.weekday_evening.publishLocalTime, "18:30");
    assert.equal(SOCIAL_BRIEF_SLOTS.friday_weekend_outlook.publishLocalTime, "18:30");
    assert.equal(SOCIAL_BRIEF_SLOTS.weekend_evening.publishLocalTime, "18:30");
    assert.ok(!("cron" in SOCIAL_BRIEF_SLOTS.weekday_evening));
  });

  it("resolves slot ids and legacy morning aliases", () => {
    assert.equal(isSocialBriefSlotId("weekday_evening"), true);
    assert.equal(isSocialBriefSlotId("weekday_morning"), false);
    assert.equal(normalizeSocialBriefSlotId("weekday_morning"), "weekday_evening");
    assert.equal(isSocialBriefSlotId("nope"), false);
    assert.equal(
      resolveSocialBriefSlot("weekend_morning").id,
      "weekend_evening",
    );
    assert.equal(resolveSocialBriefSlot("missing").id, "weekday_evening");
  });

  it("infers Friday as weekend outlook", () => {
    // 2026-10-02 is a Friday; 14:00 Europe/Riga = 11:00Z in summer (EEST UTC+3)
    const fridayAfternoon = new Date("2026-10-02T11:00:00.000Z");
    assert.equal(inferSocialBriefSlot(fridayAfternoon).id, "friday_weekend_outlook");
  });

  it("infers Saturday as weekend evening", () => {
    const saturday = new Date("2026-10-03T07:00:00.000Z");
    assert.equal(inferSocialBriefSlot(saturday).id, "weekend_evening");
  });
});

describe("social brief auth", () => {
  it("allows all requests when SOCIAL_BRIEF_SECRET is unset", () => {
    const previous = process.env.SOCIAL_BRIEF_SECRET;
    delete process.env.SOCIAL_BRIEF_SECRET;
    try {
      const request = new Request("https://example.com/api");
      assert.equal(isSocialBriefAuthorized(request), true);
    } finally {
      if (previous === undefined) delete process.env.SOCIAL_BRIEF_SECRET;
      else process.env.SOCIAL_BRIEF_SECRET = previous;
    }
  });

  it("accepts bearer or custom header when secret is set", () => {
    const previous = process.env.SOCIAL_BRIEF_SECRET;
    process.env.SOCIAL_BRIEF_SECRET = "test-secret-value";
    try {
      assert.equal(
        isSocialBriefAuthorized(
          new Request("https://example.com", {
            headers: { authorization: "Bearer test-secret-value" },
          }),
        ),
        true,
      );
      assert.equal(
        isSocialBriefAuthorized(
          new Request("https://example.com", {
            headers: { "x-social-brief-secret": "test-secret-value" },
          }),
        ),
        true,
      );
      assert.equal(
        isSocialBriefAuthorized(new Request("https://example.com")),
        false,
      );
    } finally {
      if (previous === undefined) delete process.env.SOCIAL_BRIEF_SECRET;
      else process.env.SOCIAL_BRIEF_SECRET = previous;
    }
  });
});

describe("upcoming weekend day keys", () => {
  it("returns Saturday/Sunday for a Wednesday", () => {
    // 2026-09-30 is Wednesday in Latvia
    const now = parseLaiks("202609301200");
    const keys = getUpcomingWeekendDayKeys(now);
    assert.equal(keys.saturday, "2026-10-03");
    assert.equal(keys.sunday, "2026-10-04");
  });
});
