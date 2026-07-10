import { cookies } from "next/headers";
import {
  WIND_UNITS_COOKIE_MAX_AGE,
  WIND_UNITS_COOKIE_NAME,
  parseWindUnit,
  type WindUnit,
} from "./wind-units";

export async function getWindUnitsCookie(): Promise<WindUnit> {
  const cookieStore = await cookies();
  return parseWindUnit(cookieStore.get(WIND_UNITS_COOKIE_NAME)?.value);
}

export async function setWindUnitsCookie(unit: WindUnit): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(WIND_UNITS_COOKIE_NAME, unit, {
    path: "/",
    maxAge: WIND_UNITS_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
