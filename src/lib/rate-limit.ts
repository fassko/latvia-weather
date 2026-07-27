import { createHash, randomUUID } from "crypto";

const CHAT_LIMIT_COOKIE_NAME = "lw_chat_id";
const CHAT_LIMIT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const CHAT_USER_LIMIT = 10;
const CHAT_IP_LIMIT = 30;
const CHAT_WINDOW_SECONDS = 60 * 60;

interface RateLimitCounter {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  headers: Headers;
  cookie: string | null;
  error: string | null;
}

const memoryCounters = new Map<string, RateLimitCounter>();

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return valueParts.join("=") || null;
  }

  return null;
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function createChatLimitCookie(value: string): string {
  return [
    `${CHAT_LIMIT_COOKIE_NAME}=${value}`,
    "Path=/",
    `Max-Age=${CHAT_LIMIT_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
    "HttpOnly",
    "Secure",
  ].join("; ");
}

function createRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  resetAt: number;
}): Headers {
  const headers = new Headers();
  headers.set("RateLimit-Limit", String(result.limit));
  headers.set("RateLimit-Remaining", String(Math.max(0, result.remaining)));
  headers.set("RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  return headers;
}

function getRedisConfig():
  | { url: string; token: string }
  | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;
  return { url, token };
}

async function incrementRedisCounter(
  key: string,
  windowSeconds: number,
): Promise<RateLimitCounter> {
  const config = getRedisConfig();
  if (!config) throw new Error("Redis rate limit config is missing.");

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, windowSeconds, "NX"],
      ["TTL", key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Redis rate limit request failed.");
  }

  const data = (await response.json()) as Array<{ result: unknown }>;
  const count = Number(data[0]?.result ?? 1);
  const ttl = Number(data[2]?.result ?? windowSeconds);
  const resetAt = Date.now() + Math.max(1, ttl) * 1000;

  return { count, resetAt };
}

function incrementMemoryCounter(
  key: string,
  windowSeconds: number,
): RateLimitCounter {
  const now = Date.now();
  const existing = memoryCounters.get(key);

  if (!existing || existing.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowSeconds * 1000 };
    memoryCounters.set(key, next);
    return next;
  }

  existing.count += 1;
  return existing;
}

async function incrementCounter(
  key: string,
  windowSeconds: number,
): Promise<RateLimitCounter> {
  if (getRedisConfig()) {
    try {
      return await incrementRedisCounter(key, windowSeconds);
    } catch {
      return incrementMemoryCounter(key, windowSeconds);
    }
  }

  return incrementMemoryCounter(key, windowSeconds);
}

export async function checkChatRateLimit(request: Request): Promise<RateLimitResult> {
  const existingVisitorId = getCookie(request, CHAT_LIMIT_COOKIE_NAME);
  const visitorId = existingVisitorId ?? randomUUID();
  const ip = getClientIp(request);

  const [userCounter, ipCounter] = await Promise.all([
    incrementCounter(`chat:user:${hashValue(visitorId)}`, CHAT_WINDOW_SECONDS),
    incrementCounter(`chat:ip:${hashValue(ip)}`, CHAT_WINDOW_SECONDS),
  ]);

  const userRemaining = CHAT_USER_LIMIT - userCounter.count;
  const ipRemaining = CHAT_IP_LIMIT - ipCounter.count;
  const allowed = userRemaining >= 0 && ipRemaining >= 0;
  const constrainedByUser = userRemaining <= ipRemaining;
  const limit = constrainedByUser ? CHAT_USER_LIMIT : CHAT_IP_LIMIT;
  const remaining = Math.min(userRemaining, ipRemaining);
  const resetAt = Math.max(userCounter.resetAt, ipCounter.resetAt);
  const headers = createRateLimitHeaders({ limit, remaining, resetAt });

  if (!allowed) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    headers.set("Retry-After", String(retryAfter));
  }

  const cookie = existingVisitorId ? null : createChatLimitCookie(visitorId);
  if (cookie) headers.append("Set-Cookie", cookie);

  return {
    allowed,
    limit,
    remaining,
    resetAt: new Date(resetAt),
    headers,
    cookie,
    error: allowed
      ? null
      : "Too many assistant messages. Please try again later.",
  };
}
