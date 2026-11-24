import { parseLaiks } from "@/lib/weather/timezone";

/**
 * Weather radar for the map's "radar" layer.
 *
 * - `lvgmc`: LVĢMC's OPERA composite over Latvia, a 500×500 PNG every 10 minutes
 *   (the same images as videscentrs.lvgmc.lv/karte/s/meteorologiska-radara-informacija).
 * - `ee`: the Estonian Environment Agency's composite from its public WMS, with
 *   observed frames (`ilm:cmp_cap`) and the short nowcast (`ilm:nowcasting`).
 * - `lt`: the Lithuanian Hydrometeorological Service (LHMT)'s composite from meteo.lt, a 4000×3669 PNG every
 *   5 minutes. It's cropped, shrunk and cleaned by `/api/radar/lt/[stamp]` before clients get it.
 *
 * All are drawn as one image per frame, stretched over fixed bounds in Web Mercator.
 */

export const RADAR_SOURCES = ["lvgmc", "ee", "lt"] as const;
export type RadarSource = (typeof RADAR_SOURCES)[number];
export const DEFAULT_RADAR_SOURCE: RadarSource = "lvgmc";

/** [[south, west], [north, east]] */
export type RadarBounds = [[number, number], [number, number]];

export interface RadarFrame {
  /** ISO time (UTC). */
  time: string;
  url: string;
  /** True for a forecast (nowcast) frame rather than an observation. */
  nowcast: boolean;
}

export interface RadarFeed {
  source: RadarSource;
  frames: RadarFrame[];
  bounds: RadarBounds;
  /** Credit line as HTML, for Leaflet's attribution control. */
  attribution: string;
  /** The same credit as plain text, for the mobile apps. */
  attributionText: string;
  /**
   * Colour bins low to high, so clients can draw the source's own legend. Labels are mm/h; a source that publishes
   * no scale (Lithuania) has bins without labels.
   */
  legend: RadarLegendBin[];
}

export function parseRadarSource(value: string | string[] | null | undefined): RadarSource {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "ee" || raw === "lt" ? raw : DEFAULT_RADAR_SOURCE;
}

const MINUTE_MS = 60 * 1000;

/* ---------------------------------- LVĢMC --------------------------------- */

export const LVGMC_ORIGIN = "https://videscentrs.lvgmc.lv";
/** `path` of the radar entry in `/data/static_maps_settings`. */
export const LVGMC_RADAR_PATH = "Latvija/Latvija_satelits";
/** `image_bounding_box` of the radar entry in `/data/static_maps_settings`. */
export const LVGMC_RADAR_BOUNDS: RadarBounds = [
  [54.5934155033868, 19.8278947347231],
  [59.0900395033868, 28.0663127347231],
];
export const LVGMC_RADAR_ATTRIBUTION =
  'Radar © <a href="https://videscentrs.lvgmc.lv/karte/s/meteorologiska-radara-informacija" target="_blank" rel="noopener noreferrer">LVĢMC</a> / EUMETNET OPERA';
export const LVGMC_RADAR_ATTRIBUTION_TEXT = "Radar © LVĢMC / EUMETNET OPERA";
/** How far back the LVĢMC animation goes. */
export const LVGMC_RADAR_WINDOW_MINUTES = 180;

/** Riga wall time from `…/LATVIJA_202611242020_RADARS.png`, or null. */
export function parseLvgmcRadarTime(name: string): Date | null {
  const match = /_(\d{12})_RADARS\.png$/i.exec(name);
  if (!match) return null;
  try {
    return parseLaiks(match[1]);
  } catch {
    return null;
  }
}

/** Frames from `/data/static_maps?name=…`: the last `windowMinutes` before the newest image. */
export function lvgmcRadarFrames(
  entries: Array<{ name?: unknown }>,
  windowMinutes = LVGMC_RADAR_WINDOW_MINUTES,
): RadarFrame[] {
  const frames = entries
    .map((entry) => (typeof entry?.name === "string" ? entry.name : null))
    .filter((name): name is string => name !== null)
    .map((name) => ({ name, time: parseLvgmcRadarTime(name) }))
    .filter((entry): entry is { name: string; time: Date } => entry.time !== null)
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const latest = frames.at(-1);
  if (!latest) return [];
  const start = latest.time.getTime() - windowMinutes * MINUTE_MS;

  const seen = new Set<number>();
  return frames
    .filter((frame) => frame.time.getTime() >= start)
    .filter((frame) => {
      const key = frame.time.getTime();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((frame) => ({
      time: frame.time.toISOString(),
      url: `${LVGMC_ORIGIN}/kartes-images/${frame.name.split("/").map(encodeURIComponent).join("/")}`,
      nowcast: false,
    }));
}

/* --------------------------------- Estonia -------------------------------- */

export const EE_RADAR_WMS = "https://ilmgs.envir.ee/geoserver/ilm/wms";
export const EE_RADAR_OBSERVED_LAYER = "ilm:cmp_cap";
export const EE_RADAR_NOWCAST_LAYER = "ilm:nowcasting";
const EE_RADAR_STYLE = "ilm:opera_radar";
/** The map's own max bounds, so the overlay covers everything a viewer can pan to. */
export const EE_RADAR_BOUNDS: RadarBounds = [
  [53.5, 18],
  [60, 32],
];
export const EE_RADAR_IMAGE_WIDTH = 1200;
export const EE_RADAR_ATTRIBUTION =
  'Radar © <a href="https://www.ilmateenistus.ee/ilm/ilmavaatlused/radar/?lang=en" target="_blank" rel="noopener noreferrer">Keskkonnaagentuur</a>';
export const EE_RADAR_ATTRIBUTION_TEXT = "Radar © Keskkonnaagentuur";
export const EE_RADAR_WINDOW_MINUTES = 120;
export const EE_RADAR_NOWCAST_MINUTES = 120;
/** The WMS has a frame every 5 minutes; every other one keeps requests to their server down. */
export const EE_RADAR_STEP_MINUTES = 10;

const EARTH_RADIUS_M = 6378137;

/** EPSG:3857 metres for a WGS84 point. */
export function toWebMercator(lat: number, lon: number): [number, number] {
  const x = (lon * Math.PI * EARTH_RADIUS_M) / 180;
  const y = EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
}

/** Image size that keeps the bounds' Web Mercator aspect ratio. */
export function eeRadarImageSize(
  bounds: RadarBounds = EE_RADAR_BOUNDS,
  width = EE_RADAR_IMAGE_WIDTH,
): { width: number; height: number; bbox: string } {
  const [minX, minY] = toWebMercator(bounds[0][0], bounds[0][1]);
  const [maxX, maxY] = toWebMercator(bounds[1][0], bounds[1][1]);
  const height = Math.round((width * (maxY - minY)) / (maxX - minX));
  return { width, height, bbox: [minX, minY, maxX, maxY].map((v) => v.toFixed(2)).join(",") };
}

export function eeRadarFrameUrl(layer: string, time: string): string {
  const { width, height, bbox } = eeRadarImageSize();
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    LAYERS: layer,
    STYLES: EE_RADAR_STYLE,
    SRS: "EPSG:3857",
    BBOX: bbox,
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: "image/png",
    TRANSPARENT: "true",
    TIME: time,
  });
  return `${EE_RADAR_WMS}?${params.toString()}`;
}

function parseIsoDuration(value: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  const ms = (Number(h ?? 0) * 60 * 60 + Number(m ?? 0) * 60 + Number(s ?? 0)) * 1000;
  return ms > 0 ? ms : null;
}

/** Times from a WMS 1.1.1 `<Extent name="time">` (a list, `start/end/PT5M` ranges, or both). */
export function parseWmsTimeExtent(capabilitiesXml: string): Date[] {
  // WMS 1.1.1 declares `<Dimension name="time"/>` (empty) and lists the values in `<Extent name="time">`.
  const extent = [...capabilitiesXml.matchAll(/<(?:Extent|Dimension)\b[^>]*name="time"[^>]*>([^<]*)(?=<)/gi)]
    .map((match) => match[1].trim())
    .find((text) => text.length > 0);
  if (!extent) return [];

  const times: Date[] = [];
  for (const part of extent.split(",")) {
    const value = part.trim();
    if (!value) continue;

    if (value.includes("/")) {
      const [startText, endText, periodText] = value.split("/");
      const start = new Date(startText);
      const end = new Date(endText);
      const step = periodText ? parseIsoDuration(periodText) : null;
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !step) continue;
      // Only the recent end of long ranges matters; cap the expansion.
      const first = Math.max(start.getTime(), end.getTime() - 2 * 24 * 60 * MINUTE_MS);
      const aligned = start.getTime() + Math.ceil((first - start.getTime()) / step) * step;
      for (let t = aligned; t <= end.getTime(); t += step) times.push(new Date(t));
      continue;
    }

    const time = new Date(value);
    if (!Number.isNaN(time.getTime())) times.push(time);
  }

  return times.sort((a, b) => a.getTime() - b.getTime());
}

function onStep(time: Date, stepMinutes: number): boolean {
  return Math.round(time.getTime() / MINUTE_MS) % stepMinutes === 0;
}

/** Observed frames for the last window, then nowcast frames after the newest observation. */
export function eeRadarFrames(
  observedTimes: Date[],
  nowcastTimes: Date[],
  {
    windowMinutes = EE_RADAR_WINDOW_MINUTES,
    nowcastMinutes = EE_RADAR_NOWCAST_MINUTES,
    stepMinutes = EE_RADAR_STEP_MINUTES,
  } = {},
): RadarFrame[] {
  const latest = observedTimes.at(-1);
  if (!latest) return [];
  const latestMs = latest.getTime();

  // Always keep the newest observation, even when it is off-step.
  const observed = observedTimes.filter(
    (time) =>
      time.getTime() >= latestMs - windowMinutes * MINUTE_MS &&
      (onStep(time, stepMinutes) || time.getTime() === latestMs),
  );
  const nowcast = nowcastTimes.filter(
    (time) =>
      time.getTime() > latestMs &&
      time.getTime() <= latestMs + nowcastMinutes * MINUTE_MS &&
      onStep(time, stepMinutes),
  );

  const frames: RadarFrame[] = [];
  const seen = new Set<number>();
  for (const [times, layer, isNowcast] of [
    [observed, EE_RADAR_OBSERVED_LAYER, false],
    [nowcast, EE_RADAR_NOWCAST_LAYER, true],
  ] as const) {
    for (const time of times) {
      if (seen.has(time.getTime())) continue;
      seen.add(time.getTime());
      const iso = time.toISOString();
      frames.push({ time: iso, url: eeRadarFrameUrl(layer, iso), nowcast: isNowcast });
    }
  }
  return frames;
}

/* -------------------------------- Lithuania ------------------------------- */

export const LT_RADAR_PAGE = "https://www.meteo.lt/en/currently/radar-data/";
const LT_RADAR_IMAGE_BASE = "https://www.meteo.lt/meteo_jobs/radaru_informacija/";
/** The corners meteo.lt's own Leaflet map stretches each composite over. */
export const LT_RADAR_SOURCE_BOUNDS: RadarBounds = [
  [49.876389, 15.618611],
  [59.701667, 34.313611],
];
/** What we serve: the map's max bounds, clipped to the image (which stops short of 60°N). */
export const LT_RADAR_BOUNDS: RadarBounds = [
  [53.5, 18],
  [59.701667, 32],
];
export const LT_RADAR_IMAGE_WIDTH = 1000;
export const LT_RADAR_ATTRIBUTION =
  'Radar © <a href="https://www.meteo.lt/en/currently/radar-data/" target="_blank" rel="noopener noreferrer">LHMT</a>';
export const LT_RADAR_ATTRIBUTION_TEXT = "Radar © LHMT (meteo.lt)";
export const LT_RADAR_WINDOW_MINUTES = 180;
/** Frames come every 5 minutes; every other one halves the images we process and clients download. */
export const LT_RADAR_STEP_MINUTES = 10;
export const LT_RADAR_STAMP_PATTERN = /^\d{12}$/;

/** `yyyyMMddHHmm` stamps of the composites linked from the radar page, oldest first. */
export function ltRadarStamps(html: string): string[] {
  const stamps = new Set<string>();
  for (const match of html.matchAll(/Header_Radar-composite-(\d{12})\.png/g)) stamps.add(match[1]);
  return [...stamps].sort();
}

/** The stamps are UTC (the page's local-time keys are two or three hours later). */
export function parseLtRadarStamp(stamp: string): Date | null {
  if (!LT_RADAR_STAMP_PATTERN.test(stamp)) return null;
  const time = new Date(
    Date.UTC(
      Number(stamp.slice(0, 4)),
      Number(stamp.slice(4, 6)) - 1,
      Number(stamp.slice(6, 8)),
      Number(stamp.slice(8, 10)),
      Number(stamp.slice(10, 12)),
    ),
  );
  return Number.isNaN(time.getTime()) ? null : time;
}

export function ltRadarSourceUrl(stamp: string): string {
  return `${LT_RADAR_IMAGE_BASE}Header_Radar-composite-${stamp}.png`;
}

/** Frames for the last window, on a 10-minute step, with the newest always kept. */
export function ltRadarFrames(
  stamps: string[],
  frameUrl: (stamp: string) => string,
  { windowMinutes = LT_RADAR_WINDOW_MINUTES, stepMinutes = LT_RADAR_STEP_MINUTES } = {},
): RadarFrame[] {
  const frames = stamps
    .map((stamp) => ({ stamp, time: parseLtRadarStamp(stamp) }))
    .filter((frame): frame is { stamp: string; time: Date } => frame.time !== null)
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const latest = frames.at(-1);
  if (!latest) return [];
  const latestMs = latest.time.getTime();

  return frames
    .filter(
      (frame) =>
        frame.time.getTime() >= latestMs - windowMinutes * MINUTE_MS &&
        (onStep(frame.time, stepMinutes) || frame.time.getTime() === latestMs),
    )
    .map((frame) => ({ time: frame.time.toISOString(), url: frameUrl(frame.stamp), nowcast: false }));
}

/**
 * Pixel rectangle of `LT_RADAR_BOUNDS` inside a source image of the given size. The image is linear in Web
 * Mercator between `LT_RADAR_SOURCE_BOUNDS`, as Leaflet's image overlay draws it.
 */
export function ltRadarCrop(
  imageWidth: number,
  imageHeight: number,
): { left: number; top: number; width: number; height: number } {
  const [srcWest, srcSouth] = toWebMercator(LT_RADAR_SOURCE_BOUNDS[0][0], LT_RADAR_SOURCE_BOUNDS[0][1]);
  const [srcEast, srcNorth] = toWebMercator(LT_RADAR_SOURCE_BOUNDS[1][0], LT_RADAR_SOURCE_BOUNDS[1][1]);
  const [west, south] = toWebMercator(LT_RADAR_BOUNDS[0][0], LT_RADAR_BOUNDS[0][1]);
  const [east, north] = toWebMercator(LT_RADAR_BOUNDS[1][0], LT_RADAR_BOUNDS[1][1]);

  const xPx = (x: number) => ((x - srcWest) / (srcEast - srcWest)) * imageWidth;
  const yPx = (y: number) => ((srcNorth - y) / (srcNorth - srcSouth)) * imageHeight;

  const left = Math.max(0, Math.round(xPx(west)));
  const top = Math.max(0, Math.round(yPx(north)));
  const right = Math.min(imageWidth, Math.round(xPx(east)));
  const bottom = Math.min(imageHeight, Math.round(yPx(south)));
  return { left, top, width: right - left, height: bottom - top };
}

/** meteo.lt's "outside radar range" grey, and the alpha it bakes into every coloured pixel. */
const LT_MASK_RGB = [230, 230, 230] as const;
const LT_BAKED_ALPHA = 191;
/** Same strength as the Estonian WMS's no-data grey (opacity 0.3). */
const LT_MASK_ALPHA = 77;

/**
 * In place, on RGBA bytes: lighten the out-of-range mask to match Estonia's, and make rain opaque so the map's
 * own overlay opacity applies once instead of on top of meteo.lt's 75%.
 */
export function cleanLtRadarPixels(rgba: Uint8Array): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3];
    if (alpha === 0) continue;
    if (rgba[i] === LT_MASK_RGB[0] && rgba[i + 1] === LT_MASK_RGB[1] && rgba[i + 2] === LT_MASK_RGB[2]) {
      rgba[i + 3] = Math.round((alpha / LT_BAKED_ALPHA) * LT_MASK_ALPHA);
    } else {
      rgba[i + 3] = Math.min(255, Math.round((alpha / LT_BAKED_ALPHA) * 255));
    }
  }
}

/* --------------------------------- Legend --------------------------------- */

export interface RadarLegendBin {
  color: string;
  /** Label shown under this bin, if any (mm/h). */
  label?: string;
}

/** The colours in LVĢMC's own radar legend, low to high. */
export const LVGMC_RADAR_LEGEND: RadarLegendBin[] = [
  { color: "#0000C7", label: "0.3" },
  { color: "#0034FE" },
  { color: "#0179FE", label: "1" },
  { color: "#1AA1FE" },
  { color: "#54D0FE" },
  { color: "#86F0FE", label: "2.5" },
  { color: "#FEFEFE" },
  { color: "#FEF7C0" },
  { color: "#FEE502", label: "7" },
  { color: "#FEBC00" },
  { color: "#FE7300" },
  { color: "#FE3F00", label: "15" },
  { color: "#C70000" },
  { color: "#A00100" },
  { color: "#800000", label: "50" },
];

/** The `ilm:opera_radar` colour map, one bin per step from 0.1 mm/h. */
export const EE_RADAR_LEGEND: RadarLegendBin[] = [
  { color: "#0099CC", label: "0.1" },
  { color: "#005588" },
  { color: "#7DCF46", label: "0.5" },
  { color: "#1BA824" },
  { color: "#F5F53F", label: "2" },
  { color: "#F0BD31" },
  { color: "#FF7D25", label: "8" },
  { color: "#F20000" },
  { color: "#FF45FF", label: "50" },
];

/**
 * The shades meteo.lt's composites use, ordered light to heavy by how often they appear. meteo.lt publishes no
 * scale for them, so there are no mm/h labels; stronger echoes may add colours not seen here yet.
 */
export const LT_RADAR_LEGEND: RadarLegendBin[] = [
  { color: "#00C7C7" },
  { color: "#00A8AC" },
  { color: "#008261" },
  { color: "#009637" },
  { color: "#00C027" },
  { color: "#00E809" },
  { color: "#24FF24" },
];

export function radarLegend(source: RadarSource): RadarLegendBin[] {
  if (source === "ee") return EE_RADAR_LEGEND;
  if (source === "lt") return LT_RADAR_LEGEND;
  return LVGMC_RADAR_LEGEND;
}

/** Hard-stop CSS gradient, one equal-width band per bin. */
export function radarLegendGradientCss(bins: RadarLegendBin[]): string {
  const stops = bins.map((bin, index) => {
    const from = ((index / bins.length) * 100).toFixed(2);
    const to = (((index + 1) / bins.length) * 100).toFixed(2);
    return `${bin.color} ${from}% ${to}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** Labels centred on their bins, as 0–1 positions. */
export function radarLegendTicks(bins: RadarLegendBin[]): Array<{ label: string; position: number }> {
  return bins.flatMap((bin, index) =>
    bin.label ? [{ label: bin.label, position: (index + 0.5) / bins.length }] : [],
  );
}

/** Index of the newest observed frame (where the animation starts), or -1. */
export function latestObservedFrameIndex(frames: RadarFrame[]): number {
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    if (!frames[index].nowcast) return index;
  }
  return frames.length - 1;
}
