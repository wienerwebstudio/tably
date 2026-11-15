import { crc32, deflateSync } from 'node:zlib';

/** Sehr kleiner RGBA-Rasterizer + PNG-Encoder für Pass-Icons und Stempelstreifen. */
export class Canvas {
  readonly data: Buffer;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = Buffer.alloc(width * height * 4);
  }

  fill(color: Rgb, alpha = 255): this {
    for (let i = 0; i < this.width * this.height; i++) {
      this.data[i * 4] = color.r;
      this.data[i * 4 + 1] = color.g;
      this.data[i * 4 + 2] = color.b;
      this.data[i * 4 + 3] = alpha;
    }
    return this;
  }

  private blend(x: number, y: number, color: Rgb, coverage: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || coverage <= 0) return;
    const i = (y * this.width + x) * 4;
    const a = Math.min(1, coverage);
    const dstA = this.data[i + 3]! / 255;
    const outA = a + dstA * (1 - a);
    if (outA === 0) return;
    this.data[i] = Math.round((color.r * a + this.data[i]! * dstA * (1 - a)) / outA);
    this.data[i + 1] = Math.round((color.g * a + this.data[i + 1]! * dstA * (1 - a)) / outA);
    this.data[i + 2] = Math.round((color.b * a + this.data[i + 2]! * dstA * (1 - a)) / outA);
    this.data[i + 3] = Math.round(outA * 255);
  }

  /** Gefüllter Kreis bzw. Ring (innerRadius > 0) mit Kantenglättung. */
  circle(cx: number, cy: number, radius: number, color: Rgb, opts: { innerRadius?: number; opacity?: number } = {}): this {
    const inner = opts.innerRadius ?? 0;
    const opacity = opts.opacity ?? 1;
    for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
      for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const outer = Math.max(0, Math.min(1, radius - d + 0.5));
        const hole = inner > 0 ? Math.max(0, Math.min(1, d - inner + 0.5)) : 1;
        this.blend(x, y, color, outer * hole * opacity);
      }
    }
    return this;
  }

  /** Abgerundetes Rechteck. */
  roundRect(x0: number, y0: number, w: number, h: number, r: number, color: Rgb): this {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const dx = Math.max(x0 + r - (x + 0.5), 0, x + 0.5 - (x0 + w - r));
        const dy = Math.max(y0 + r - (y + 0.5), 0, y + 0.5 - (y0 + h - r));
        const d = Math.hypot(dx, dy);
        this.blend(x, y, color, Math.max(0, Math.min(1, r - d + 0.5)));
      }
    }
    return this;
  }

  toPng(): Buffer {
    const stride = this.width * 4;
    const raw = Buffer.alloc((stride + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      raw[y * (stride + 1)] = 0;
      this.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): Rgb {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`Ungültige Farbe: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbCss(hex: string): string {
  const { r, g, b } = parseHexColor(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Quadratisches Icon: abgerundete Fläche in Markenfarbe mit Stempelpunkt. */
export function renderIcon(size: number, backgroundHex: string, accentHex: string): Buffer {
  const c = new Canvas(size, size);
  c.roundRect(0, 0, size, size, size * 0.22, parseHexColor(backgroundHex));
  c.circle(size / 2, size / 2, size * 0.26, parseHexColor(accentHex));
  c.circle(size / 2, size / 2, size * 0.11, parseHexColor(backgroundHex));
  return c.toPng();
}

/** Streifenbild mit dem Stempelfortschritt (gefüllt/offen). */
export function renderStampStrip(opts: {
  width: number;
  height: number;
  total: number;
  filled: number;
  backgroundHex: string;
  accentHex: string;
  textHex: string;
}): Buffer {
  const c = new Canvas(opts.width, opts.height).fill(parseHexColor(opts.backgroundHex));
  const total = Math.max(1, Math.min(opts.total, 30));
  const rows = total <= 6 ? 1 : total <= 14 ? 2 : 3;
  const perRow = Math.ceil(total / rows);
  const padX = opts.width * 0.06;
  const padY = opts.height * 0.12;
  const cellW = (opts.width - padX * 2) / perRow;
  const cellH = (opts.height - padY * 2) / rows;
  const radius = Math.min(cellW, cellH) * 0.38;
  const accent = parseHexColor(opts.accentHex);
  const text = parseHexColor(opts.textHex);
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / perRow);
    const inRow = row === rows - 1 ? total - perRow * (rows - 1) : perRow;
    const col = i % perRow;
    const rowOffset = ((perRow - inRow) * cellW) / 2;
    const cx = padX + rowOffset + cellW * (col + 0.5);
    const cy = padY + cellH * (row + 0.5);
    if (i < opts.filled) {
      c.circle(cx, cy, radius, accent);
      c.circle(cx, cy, radius * 0.36, parseHexColor(opts.backgroundHex), { opacity: 0.9 });
    } else {
      c.circle(cx, cy, radius, text, { innerRadius: radius - Math.max(1.5, radius * 0.1), opacity: 0.45 });
    }
  }
  return c.toPng();
}
