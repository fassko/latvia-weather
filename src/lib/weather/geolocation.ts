export type BrowserGeolocationError =
  | "unsupported"
  | "permission-denied"
  | "unavailable";

export class BrowserGeolocationErrorValue extends Error {
  readonly reason: BrowserGeolocationError;

  constructor(reason: BrowserGeolocationError) {
    super(reason);
    this.reason = reason;
    this.name = "BrowserGeolocationError";
  }
}

const LOW_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 60 * 60 * 1000,
  timeout: 12_000,
};

const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30_000,
};

function isPermissionDenied(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 1;
}

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new BrowserGeolocationErrorValue("unsupported"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function getBrowserPosition(): Promise<GeolocationPosition> {
  try {
    return await getCurrentPosition(LOW_ACCURACY_OPTIONS);
  } catch (error) {
    if (error instanceof BrowserGeolocationErrorValue) throw error;
    if (isPermissionDenied(error)) {
      throw new BrowserGeolocationErrorValue("permission-denied");
    }
  }

  try {
    return await getCurrentPosition(HIGH_ACCURACY_OPTIONS);
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new BrowserGeolocationErrorValue("permission-denied");
    }

    throw new BrowserGeolocationErrorValue("unavailable");
  }
}
