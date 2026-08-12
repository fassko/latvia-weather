import { parseLaiks } from "./timezone";

const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const J0 = 0.0009;
const RAD = Math.PI / 180;
const E = RAD * 23.4397;
const SOLAR_DISC_ANGLE = -0.833 * RAD;

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

function toJulian(date: Date): number {
  return date.getTime() / DAY_MS - 0.5 + J1970;
}

function fromJulian(julian: number): Date {
  return new Date((julian + 0.5 - J1970) * DAY_MS);
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function declination(longitude: number, latitude: number): number {
  return Math.asin(
    Math.sin(latitude) * Math.cos(E) +
      Math.cos(latitude) * Math.sin(E) * Math.sin(longitude),
  );
}

function solarMeanAnomaly(days: number): number {
  return RAD * (357.5291 + 0.98560028 * days);
}

function eclipticLongitude(meanAnomaly: number): number {
  const equationOfCenter =
    RAD *
    (1.9148 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly));
  const perihelion = RAD * 102.9372;

  return meanAnomaly + equationOfCenter + perihelion + Math.PI;
}

function julianCycle(days: number, longitude: number): number {
  return Math.round(days - J0 - longitude / (2 * Math.PI));
}

function approximateTransit(hourAngle: number, longitude: number, cycle: number): number {
  return J0 + (hourAngle + longitude) / (2 * Math.PI) + cycle;
}

function solarTransitJ(approxTransitValue: number, meanAnomaly: number, longitude: number): number {
  return (
    J2000 +
    approxTransitValue +
    0.0053 * Math.sin(meanAnomaly) -
    0.0069 * Math.sin(2 * longitude)
  );
}

function hourAngle(height: number, latitude: number, declinationValue: number): number {
  return Math.acos(
    (Math.sin(height) - Math.sin(latitude) * Math.sin(declinationValue)) /
      (Math.cos(latitude) * Math.cos(declinationValue)),
  );
}

function getSetJulian(
  height: number,
  longitude: number,
  latitude: number,
  declinationValue: number,
  cycle: number,
  meanAnomaly: number,
  eclipticLongitudeValue: number,
): number {
  const angle = hourAngle(height, latitude, declinationValue);
  const transit = approximateTransit(angle, longitude, cycle);

  return solarTransitJ(transit, meanAnomaly, eclipticLongitudeValue);
}

export function getSunTimes(date: Date, lat: number, lon: number): SunTimes | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const longitude = RAD * -lon;
  const latitude = RAD * lat;
  const days = toDays(date);
  const cycle = julianCycle(days, longitude);
  const transit = approximateTransit(0, longitude, cycle);
  const meanAnomaly = solarMeanAnomaly(transit);
  const eclipticLongitudeValue = eclipticLongitude(meanAnomaly);
  const declinationValue = declination(eclipticLongitudeValue, 0);
  const noon = solarTransitJ(transit, meanAnomaly, eclipticLongitudeValue);
  const sunset = getSetJulian(
    SOLAR_DISC_ANGLE,
    longitude,
    latitude,
    declinationValue,
    cycle,
    meanAnomaly,
    eclipticLongitudeValue,
  );

  if (!Number.isFinite(sunset)) return null;

  return {
    sunrise: fromJulian(noon - (sunset - noon)),
    sunset: fromJulian(sunset),
  };
}

export function getSunTimesForLatviaDay(
  dayKey: string,
  lat: number,
  lon: number,
): SunTimes | null {
  return getSunTimes(parseLaiks(`${dayKey.replaceAll("-", "")}1200`), lat, lon);
}
