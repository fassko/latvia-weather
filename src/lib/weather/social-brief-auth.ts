import { timingSafeEqual } from "node:crypto";

function secretsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * When SOCIAL_BRIEF_SECRET is set, forecast payloads require:
 *   Authorization: Bearer <secret>
 * or
 *   x-social-brief-secret: <secret>
 *
 * Schema and schedule catalog endpoints stay public.
 */
export function isSocialBriefAuthorized(request: Request): boolean {
  const expected = process.env.SOCIAL_BRIEF_SECRET;
  if (!expected) return true;

  const bearer = request.headers.get("authorization");
  const fromBearer = bearer?.startsWith("Bearer ")
    ? bearer.slice("Bearer ".length).trim()
    : null;
  const fromHeader = request.headers.get("x-social-brief-secret")?.trim() ?? null;
  const provided = fromBearer || fromHeader;

  if (!provided) return false;
  return secretsMatch(provided, expected);
}
