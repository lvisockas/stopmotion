import { mulberry32, hashInts, STREAM } from './prng';
import { HEIGHT, WIDTH, type Ctx2D, type DrawableImage } from './types';

export interface Scratch {
  canvas: DrawableImage;
  ctx: Ctx2D;
}

export type CanvasFactory = (width: number, height: number) => Scratch;

const defaultFactory: CanvasFactory = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, ctx: canvas.getContext('2d') as OffscreenCanvasRenderingContext2D };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') as CanvasRenderingContext2D };
};

let factory: CanvasFactory = defaultFactory;

/** Lets non-browser hosts (node tests) supply their own canvas implementation. */
export function setCanvasFactory(f: CanvasFactory): void {
  factory = f;
  cache.clear();
}

/**
 * Generated textures are pure functions of their key, so caching them keeps
 * drawFrame deterministic while making it cheap.
 */
const cache = new Map<string, DrawableImage>();
function cached(key: string, make: () => DrawableImage): DrawableImage {
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size > 40) cache.clear();
    hit = make();
    cache.set(key, hit);
  }
  return hit;
}

/** A generated, cached texture: `paint` must be a pure function of the key. */
export function cachedTexture(key: string, width: number, height: number, paint: (ctx: Ctx2D) => void): DrawableImage {
  return cached(key, () => {
    const { canvas, ctx } = factory(width, height);
    paint(ctx);
    return canvas;
  });
}

export function parseHex(color: string): [number, number, number] {
  let hex = color.trim().replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex.slice(0, 6), 16);
  if (!/^[0-9a-f]{6}/i.test(hex) || Number.isNaN(n)) return [240, 234, 222];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Bilinear value noise over a gw×gh lattice of random values in [-1, 1]. */
function lattice(rng: () => number, gw: number, gh: number) {
  const v = new Float32Array((gw + 1) * (gh + 1));
  for (let i = 0; i < v.length; i++) v[i] = rng() * 2 - 1;
  return (u: number, w: number) => {
    const x = u * gw;
    const y = w * gh;
    const x0 = Math.min(gw - 1, Math.floor(x));
    const y0 = Math.min(gh - 1, Math.floor(y));
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const i = y0 * (gw + 1) + x0;
    const a = v[i] + (v[i + 1] - v[i]) * sx;
    const b = v[i + gw + 1] + (v[i + gw + 2] - v[i + gw + 1]) * sx;
    return a + (b - a) * sy;
  };
}

/** Full-frame paper: base colour, soft mottling, fine tooth, a few fibres. */
export function paperTexture(color: string, seed: number): DrawableImage {
  return cached(`paper|${color}|${seed}`, () => {
    const { canvas, ctx } = factory(WIDTH, HEIGHT);
    const [r, g, b] = parseHex(color);
    const rng = mulberry32(hashInts(seed, STREAM.paper));
    const big = lattice(rng, 6, 8);
    const mid = lattice(rng, 36, 45);
    const img = ctx.createImageData(WIDTH, HEIGHT);
    const d = img.data;
    for (let y = 0, p = 0; y < HEIGHT; y++) {
      const v = y / HEIGHT;
      for (let x = 0; x < WIDTH; x++, p += 4) {
        const u = x / WIDTH;
        const k = 1 + 0.035 * big(u, v) + 0.012 * mid(u, v) + 0.03 * (rng() - 0.5);
        d[p] = r * k;
        d[p + 1] = g * k;
        d[p + 2] = b * k;
        d[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // fibres
    ctx.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const x = rng() * WIDTH;
      const y = rng() * HEIGHT;
      const a = rng() * Math.PI * 2;
      const len = 6 + rng() * 26;
      const dark = rng() < 0.6;
      ctx.strokeStyle = dark ? `rgba(60,45,30,${0.03 + rng() * 0.05})` : `rgba(255,255,250,${0.1 + rng() * 0.15})`;
      ctx.lineWidth = 0.6 + rng() * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(a) * len * 0.5 + (rng() - 0.5) * 6,
        y + Math.sin(a) * len * 0.5 + (rng() - 0.5) * 6,
        x + Math.cos(a) * len,
        y + Math.sin(a) * len,
      );
      ctx.stroke();
    }
    return canvas;
  });
}

export const GRAIN_TILE = 256;
export const GRAIN_VARIANTS = 4;

/** Mid-grey noise tile; composited with 'overlay' it only adds grain. */
export function grainTile(variant: number): DrawableImage {
  return cached(`grain|${variant}`, () => {
    const { canvas, ctx } = factory(GRAIN_TILE, GRAIN_TILE);
    const rng = mulberry32(hashInts(STREAM.grain, variant, 0x9e37));
    const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const d = img.data;
    for (let p = 0; p < d.length; p += 4) {
      // sum of 3 uniforms ≈ gaussian, softer than white noise
      const n = (rng() + rng() + rng() - 1.5) / 1.5;
      const v = 128 + n * 90;
      d[p] = v;
      d[p + 1] = v;
      d[p + 2] = v;
      d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  });
}

/**
 * A transparent cutout as a paper sticker: the picture on a white paper
 * border that follows its silhouette, like something cut out with scissors
 * leaving a margin. The border is the alpha mask dilated by drawing it at
 * offsets around a circle, with a slightly uneven radius (hand-cut).
 */
export function stickerTexture(id: string, img: DrawableImage, w: number, h: number, border: number): DrawableImage {
  const W = Math.ceil(w + 2 * border + 4);
  const H = Math.ceil(h + 2 * border + 4);
  return cachedTexture(`sticker|${id}|${Math.round(w)}|${Math.round(h)}|${border}`, W, H, (ctx) => {
    const { canvas: mask, ctx: m } = factory(W, H);
    m.imageSmoothingQuality = 'high';
    m.drawImage(img, border + 2, border + 2, w, h);
    m.globalCompositeOperation = 'source-in';
    m.fillStyle = '#fbf9f4';
    m.fillRect(0, 0, W, H);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const r = border * (0.82 + 0.18 * Math.abs(Math.sin(a * 3 + 1.3)));
      ctx.drawImage(mask, Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, border + 2, border + 2, w, h);
  });
}
