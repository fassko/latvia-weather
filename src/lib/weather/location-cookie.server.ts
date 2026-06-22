import { cookies } from "next/headers";
import {
  LOCATION_COOKIE_MAX_AGE,
  LOCATION_COOKIE_NAME,
} from "./location-cookie";

export async function getLocationCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(LOCATION_COOKIE_NAME)?.value;
}

export async function setLocationCookie(punkts: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCATION_COOKIE_NAME, punkts, {
    path: "/",
    maxAge: LOCATION_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
