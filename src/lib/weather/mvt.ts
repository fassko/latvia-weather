/**
 * A small Mapbox Vector Tile reader: enough to pull points and their properties out of a tile without a
 * protobuf dependency. Only the first point of each feature is read, which is all a point layer has.
 */

export type MvtValue = string | number | boolean | null;

export interface MvtFeature {
  properties: Record<string, MvtValue>;
  /** First point of the geometry in WGS84, or null when the feature has none. */
  lon: number | null;
  lat: number | null;
}

export interface MvtTile {
  z: number;
  x: number;
  y: number;
}

const WIRE_VARINT = 0;
const WIRE_64BIT = 1;
const WIRE_LENGTH = 2;
const WIRE_32BIT = 5;

const textDecoder = new TextDecoder();

class Reader {
  readonly buf: Uint8Array;
  readonly end: number;
  pos: number;

  constructor(buf: Uint8Array, start = 0, end = buf.length) {
    this.buf = buf;
    this.end = end;
    this.pos = start;
  }

  get done(): boolean {
    return this.pos >= this.end;
  }

  varint(): number {
    let result = 0;
    let multiplier = 1;
    for (;;) {
      if (this.pos >= this.end) throw new Error("Truncated varint in vector tile");
      const byte = this.buf[this.pos++];
      result += (byte & 0x7f) * multiplier;
      if (byte < 0x80) return result;
      multiplier *= 128;
    }
  }

  /** Next field key as [field number, wire type]. */
  key(): [number, number] {
    const key = this.varint();
    return [Math.floor(key / 8), key & 7];
  }

  /** Sub-reader over a length-delimited field. */
  sub(): Reader {
    const length = this.varint();
    const start = this.pos;
    this.pos += length;
    if (this.pos > this.end) throw new Error("Truncated field in vector tile");
    return new Reader(this.buf, start, start + length);
  }

  skip(wireType: number): void {
    switch (wireType) {
      case WIRE_VARINT:
        this.varint();
        return;
      case WIRE_64BIT:
        this.pos += 8;
        return;
      case WIRE_LENGTH:
        this.pos += this.varint();
        return;
      case WIRE_32BIT:
        this.pos += 4;
        return;
      default:
        throw new Error(`Unknown wire type ${wireType} in vector tile`);
    }
  }

  string(): string {
    const sub = this.sub();
    return textDecoder.decode(sub.buf.subarray(sub.pos, sub.end));
  }

  packed(): number[] {
    const sub = this.sub();
    const values: number[] = [];
    while (!sub.done) values.push(sub.varint());
    return values;
  }
}

function zigzag(value: number): number {
  return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
}

function readValue(reader: Reader): MvtValue {
  let value: MvtValue = null;
  while (!reader.done) {
    const [field, wire] = reader.key();
    const view = new DataView(reader.buf.buffer, reader.buf.byteOffset + reader.pos);
    switch (field) {
      case 1:
        value = reader.string();
        break;
      case 2:
        value = view.getFloat32(0, true);
        reader.pos += 4;
        break;
      case 3:
        value = view.getFloat64(0, true);
        reader.pos += 8;
        break;
      case 4:
      case 5:
        value = reader.varint();
        break;
      case 6:
        value = zigzag(reader.varint());
        break;
      case 7:
        value = reader.varint() !== 0;
        break;
      default:
        reader.skip(wire);
    }
  }
  return value;
}

/** Tile-pixel position to longitude/latitude. */
export function tilePointToLonLat(
  tile: MvtTile,
  extent: number,
  px: number,
  py: number,
): { lon: number; lat: number } {
  const n = 2 ** tile.z;
  const lon = ((tile.x + px / extent) / n) * 360 - 180;
  const mercY = Math.PI * (1 - (2 * (tile.y + py / extent)) / n);
  const lat = (Math.atan(Math.sinh(mercY)) * 180) / Math.PI;
  return { lon, lat };
}

function firstPoint(geometry: number[]): [number, number] | null {
  // MoveTo(1) with a count of at least one, then a zigzag-encoded x and y.
  if (geometry.length < 3 || (geometry[0] & 7) !== 1) return null;
  return [zigzag(geometry[1]), zigzag(geometry[2])];
}

/** Every layer in the tile, keyed by layer name. */
export function decodeMvt(data: Uint8Array, tile: MvtTile): Map<string, MvtFeature[]> {
  const layers = new Map<string, MvtFeature[]>();
  const reader = new Reader(data);

  while (!reader.done) {
    const [field, wire] = reader.key();
    if (field !== 3 || wire !== WIRE_LENGTH) {
      reader.skip(wire);
      continue;
    }

    const layer = reader.sub();
    let name = "";
    let extent = 4096;
    const keys: string[] = [];
    const values: MvtValue[] = [];
    const rawFeatures: Reader[] = [];

    while (!layer.done) {
      const [lf, lw] = layer.key();
      if (lf === 1 && lw === WIRE_LENGTH) name = layer.string();
      else if (lf === 2 && lw === WIRE_LENGTH) rawFeatures.push(layer.sub());
      else if (lf === 3 && lw === WIRE_LENGTH) keys.push(layer.string());
      else if (lf === 4 && lw === WIRE_LENGTH) values.push(readValue(layer.sub()));
      else if (lf === 5 && lw === WIRE_VARINT) extent = layer.varint();
      else layer.skip(lw);
    }

    const features: MvtFeature[] = rawFeatures.map((feature) => {
      let tags: number[] = [];
      let geometry: number[] = [];
      while (!feature.done) {
        const [ff, fw] = feature.key();
        if (ff === 2 && fw === WIRE_LENGTH) tags = feature.packed();
        else if (ff === 4 && fw === WIRE_LENGTH) geometry = feature.packed();
        else feature.skip(fw);
      }

      const properties: Record<string, MvtValue> = {};
      for (let i = 0; i + 1 < tags.length; i += 2) {
        const key = keys[tags[i]];
        if (key !== undefined) properties[key] = values[tags[i + 1]] ?? null;
      }

      const point = firstPoint(geometry);
      const position = point ? tilePointToLonLat(tile, extent, point[0], point[1]) : null;
      return { properties, lon: position?.lon ?? null, lat: position?.lat ?? null };
    });

    layers.set(name, [...(layers.get(name) ?? []), ...features]);
  }

  return layers;
}
