import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkChatRateLimit } from "../src/lib/rate-limit.ts";

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function getChatCookie(setCookie: string): string {
  const [cookie] = setCookie.split(";");
  return cookie;
}

describe("chat rate limit", () => {
  it("limits repeated assistant requests from the same anonymous user", async () => {
    const previousUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const previousUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const previousKvUrl = process.env.KV_REST_API_URL;
    const previousKvToken = process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    try {
      const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
      const first = await checkChatRateLimit(
        new Request("https://latvia-weather.test/api/chat", {
          method: "POST",
          headers: { "x-forwarded-for": ip },
        }),
      );

      assert.equal(first.allowed, true);
      assert.equal(first.limit, 10);
      assert.equal(first.remaining, 9);
      assert.ok(first.headers.get("set-cookie"));

      const cookie = getChatCookie(first.headers.get("set-cookie") ?? "");

      for (let index = 0; index < 9; index += 1) {
        const result = await checkChatRateLimit(
          new Request("https://latvia-weather.test/api/chat", {
            method: "POST",
            headers: { cookie, "x-forwarded-for": ip },
          }),
        );
        assert.equal(result.allowed, true);
      }

      const blocked = await checkChatRateLimit(
        new Request("https://latvia-weather.test/api/chat", {
          method: "POST",
          headers: { cookie, "x-forwarded-for": ip },
        }),
      );

      assert.equal(blocked.allowed, false);
      assert.equal(blocked.headers.get("ratelimit-remaining"), "0");
      assert.ok(blocked.headers.get("retry-after"));
    } finally {
      restoreEnv("UPSTASH_REDIS_REST_URL", previousUpstashUrl);
      restoreEnv("UPSTASH_REDIS_REST_TOKEN", previousUpstashToken);
      restoreEnv("KV_REST_API_URL", previousKvUrl);
      restoreEnv("KV_REST_API_TOKEN", previousKvToken);
    }
  });
});
