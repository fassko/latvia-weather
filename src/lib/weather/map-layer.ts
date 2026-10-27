/** The map's weather layers. Temperature is the default and isn't written to the URL. */
export const MAP_LAYERS = ["temperature", "wind", "rain"] as const;

export type MapLayer = (typeof MAP_LAYERS)[number];

export const DEFAULT_MAP_LAYER: MapLayer = "temperature";
export const MAP_LAYER_QUERY_KEY = "layer";

/** Layer from a `?layer=` value; anything unknown is temperature. */
export function parseMapLayer(value: string | string[] | null | undefined): MapLayer {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "wind" || raw === "rain" ? raw : DEFAULT_MAP_LAYER;
}

/** `search` (e.g. `?alarms=0`) with the layer set, or removed for temperature. */
export function mapLayerSearch(search: string, layer: MapLayer): string {
  const params = new URLSearchParams(search);
  if (layer === DEFAULT_MAP_LAYER) params.delete(MAP_LAYER_QUERY_KEY);
  else params.set(MAP_LAYER_QUERY_KEY, layer);
  const query = params.toString();
  return query ? `?${query}` : "";
}
