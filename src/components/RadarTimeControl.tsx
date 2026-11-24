"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  latestObservedFrameIndex,
  RADAR_SOURCES,
  type RadarFeed,
  type RadarFrame,
  type RadarSource,
} from "@/lib/weather/radar";
import { formatLatviaTime } from "@/lib/weather/timezone";

const RADAR_REFRESH_MS = 5 * 60 * 1000;
const RADAR_FRAME_MS = 650;
/** Hold the newest observation a little longer each loop so it reads as "now". */
const RADAR_LATEST_HOLD_FRAMES = 2;
const RADAR_PRELOAD_AHEAD = 2;
const NO_FRAMES: RadarFrame[] = [];

async function fetchRadarFeed(source: RadarSource, signal: AbortSignal): Promise<RadarFeed> {
  const response = await fetch(`/api/radar?source=${source}`, { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error(`Radar API returned ${response.status}`);
  }
  return (await response.json()) as RadarFeed;
}

export interface RadarState {
  source: RadarSource;
  setSource: (source: RadarSource) => void;
  feed: RadarFeed | null;
  frame: RadarFrame | null;
  index: number;
  setIndex: (index: number) => void;
  isPlaying: boolean;
  togglePlay: () => void;
  isLoading: boolean;
  hasError: boolean;
  retry: () => void;
}

/** Radar frames for the map, refreshed while `enabled`, with an index and looped playback. */
export function useRadar(enabled: boolean): RadarState {
  const [source, setSourceState] = useState<RadarSource>("lvgmc");
  const [feed, setFeed] = useState<RadarFeed | null>(null);
  const [index, setIndexState] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  // Follow the newest frame across refreshes unless the viewer has moved away from it.
  const followLatestRef = useRef(true);
  const holdRef = useRef(0);
  const feedRef = useRef(feed);
  const indexRef = useRef(index);

  const frames = feed?.source === source ? feed.frames : NO_FRAMES;
  const frame = frames[index] ?? null;
  const playing = enabled && isPlaying;

  useEffect(() => {
    feedRef.current = feed;
    indexRef.current = index;
  }, [feed, index]);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();

    function load() {
      setIsLoading(true);
      fetchRadarFeed(source, controller.signal)
        .then((next) => {
          const previous = feedRef.current;
          const latest = latestObservedFrameIndex(next.frames);
          let nextIndex = latest;
          if (previous?.source === next.source && !followLatestRef.current) {
            // Keep showing the same moment if it is still in the new list.
            const currentTime = previous.frames[indexRef.current]?.time;
            const same = next.frames.findIndex((f) => f.time === currentTime);
            if (same >= 0) nextIndex = same;
          }
          setHasError(false);
          setFeed(next);
          setIndexState(nextIndex);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          console.error("Radar feed failed", error);
          setHasError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }

    load();
    const timer = window.setInterval(load, RADAR_REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [enabled, reloadToken, source]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;

    const latest = latestObservedFrameIndex(frames);
    const interval = window.setInterval(() => {
      setIndexState((current) => {
        if (current === latest && holdRef.current < RADAR_LATEST_HOLD_FRAMES) {
          holdRef.current += 1;
          return current;
        }
        holdRef.current = 0;
        return current >= frames.length - 1 ? 0 : current + 1;
      });
    }, RADAR_FRAME_MS);

    return () => window.clearInterval(interval);
  }, [frames, playing]);

  // Warm the browser cache for the next frames so playback swaps instantly.
  useEffect(() => {
    if (!enabled || frames.length === 0) return;
    for (let step = 1; step <= RADAR_PRELOAD_AHEAD; step += 1) {
      const next = frames[(index + step) % frames.length];
      if (next) new Image().src = next.url;
    }
  }, [enabled, frames, index]);

  function setIndex(nextIndex: number) {
    if (frames.length === 0) return;
    const bounded = Math.min(Math.max(nextIndex, 0), frames.length - 1);
    followLatestRef.current = bounded === latestObservedFrameIndex(frames);
    setIsPlaying(false);
    setIndexState(bounded);
  }

  function setSource(next: RadarSource) {
    if (next === source) return;
    followLatestRef.current = true;
    setIsPlaying(false);
    setHasError(false);
    setSourceState(next);
  }

  function togglePlay() {
    // While playing, a refresh shouldn't yank the animation back to the newest frame.
    followLatestRef.current = playing;
    setIsPlaying(!playing);
  }

  function retry() {
    setHasError(false);
    setReloadToken((token) => token + 1);
  }

  return {
    source,
    setSource,
    feed: feed?.source === source ? feed : null,
    frame,
    index,
    setIndex,
    isPlaying: playing,
    togglePlay,
    isLoading: isLoading && frames.length === 0,
    hasError,
    retry,
  };
}

function PlayIcon({ paused }: { paused?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      {paused ? (
        <>
          <rect x="4" y="3" width="2.5" height="10" rx="0.6" />
          <rect x="9.5" y="3" width="2.5" height="10" rx="0.6" />
        </>
      ) : (
        <path d="M5 3.6v8.8c0 .6.7 1 1.2.6l6.1-4.4c.4-.3.4-.9 0-1.2L6.2 3C5.7 2.6 5 3 5 3.6Z" />
      )}
    </svg>
  );
}

function radarSourceLabelKey(
  source: RadarSource,
): "radarSourceLvgmc" | "radarSourceEe" | "radarSourceLt" {
  if (source === "ee") return "radarSourceEe";
  if (source === "lt") return "radarSourceLt";
  return "radarSourceLvgmc";
}

function radarAboutKey(source: RadarSource): "radarAboutLvgmc" | "radarAboutEe" | "radarAboutLt" {
  if (source === "ee") return "radarAboutEe";
  if (source === "lt") return "radarAboutLt";
  return "radarAboutLvgmc";
}

function frameClock(frame: RadarFrame | null | undefined): string {
  return frame ? formatLatviaTime(new Date(frame.time), "HH:mm") : "";
}

export function RadarTimeControl({ radar }: { radar: RadarState }) {
  const tMap = useTranslations("map");
  const tErrors = useTranslations("errors");
  const frames = radar.feed?.frames ?? [];
  const lastIndex = Math.max(frames.length - 1, 0);
  const latestIndex = latestObservedFrameIndex(frames);
  const hasFrames = frames.length > 0 && radar.frame !== null;
  const nowcastStart = frames.findIndex((frame) => frame.nowcast);

  const value = !hasFrames
    ? " "
    : radar.frame?.nowcast
      ? tMap("radarNowcastAt", { time: frameClock(radar.frame) })
      : radar.index === latestIndex
        ? tMap("radarLatestAt", { time: frameClock(radar.frame) })
        : frameClock(radar.frame);

  return (
    <div className="weather-map-time-control weather-map-time-control--radar">
      <div className="weather-map-time-control__header">
        <div
          className="weather-map-radar-source"
          role="radiogroup"
          aria-label={tMap("radarSource")}
        >
          {RADAR_SOURCES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={radar.source === option}
              className="weather-map-radar-source__option"
              onClick={() => radar.setSource(option)}
            >
              {tMap(radarSourceLabelKey(option))}
            </button>
          ))}
        </div>
        <output
          className="weather-map-time-control__value"
          htmlFor="weather-map-radar-slider"
          data-nowcast={radar.frame?.nowcast ? "true" : undefined}
        >
          {value}
        </output>
      </div>
      <div className="weather-map-time-control__controls">
        <button
          type="button"
          className="weather-map-time-control__play"
          onClick={radar.togglePlay}
          disabled={frames.length < 2}
          aria-label={radar.isPlaying ? tMap("forecastPause") : tMap("forecastPlay")}
        >
          <PlayIcon paused={radar.isPlaying} />
          <span>{radar.isPlaying ? tMap("forecastPause") : tMap("forecastPlay")}</span>
        </button>
        <button
          type="button"
          className="weather-map-time-control__stepper weather-map-time-control__stepper--back"
          onClick={() => radar.setIndex(radar.index - 1)}
          disabled={!hasFrames || radar.index <= 0}
          aria-label={tMap("radarPreviousFrame")}
        >
          -
        </button>
        <div className="weather-map-time-control__timeline weather-map-radar-timeline">
          {nowcastStart > 0 ? (
            <span
              className="weather-map-radar-timeline__nowcast"
              style={{ left: `${(nowcastStart / Math.max(lastIndex, 1)) * 100}%` }}
              aria-hidden="true"
            />
          ) : null}
          <input
            id="weather-map-radar-slider"
            className="weather-map-time-control__slider"
            type="range"
            min={0}
            max={lastIndex}
            step={1}
            value={Math.max(radar.index, 0)}
            disabled={!hasFrames}
            aria-label={tMap("radarTime")}
            aria-valuetext={value}
            onChange={(event) => radar.setIndex(Number(event.currentTarget.value))}
          />
          <div className="weather-map-radar-timeline__ends" aria-hidden="true">
            <span>{frameClock(frames[0])}</span>
            {nowcastStart > 0 ? (
              <span className="weather-map-radar-timeline__now">
                {frameClock(frames[latestIndex])}
              </span>
            ) : null}
            <span>{frameClock(frames[lastIndex])}</span>
          </div>
        </div>
        <button
          type="button"
          className="weather-map-time-control__stepper weather-map-time-control__stepper--forward"
          onClick={() => radar.setIndex(radar.index + 1)}
          disabled={!hasFrames || radar.index >= lastIndex}
          aria-label={tMap("radarNextFrame")}
        >
          +
        </button>
      </div>
      <p className="weather-map-time-control__status" role="status">
        {radar.isLoading
          ? tMap("radarLoading")
          : radar.hasError && !hasFrames
            ? tMap("radarError")
            : tMap(radarAboutKey(radar.source))}
        {radar.hasError && !radar.isLoading && !hasFrames ? (
          <button
            type="button"
            className="weather-map-time-control__retry"
            onClick={radar.retry}
          >
            {tErrors("tryAgain")}
          </button>
        ) : null}
      </p>
    </div>
  );
}
