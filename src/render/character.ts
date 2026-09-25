import { mulberry32, hashInts } from './prng';
import type { Ctx2D, LookOverrides } from './types';

/**
 * Original construction-paper cutout kids: big round head, two touching oval
 * eyes, mitten hands, a coat and a hat or hair. Flat colours with a dark
 * cut edge. Everything is derived from the member's seed.
 */
/** Design units of the drawing below. */
const BASE_W = 200;
const BASE_H = 330;
/** On-frame size: about 30% of the frame height. */
export const CHARACTER_W = BASE_W * 1.22;
export const CHARACTER_H = BASE_H * 1.22;

const SKIN = ['#f6d2b1', '#eab58c', '#c98e60', '#8f5b3a', '#f2c7a1', '#5e3a24'];
const COATS = ['#d9412b', '#2f6fd1', '#3f9b47', '#e3a21a', '#7b4bb7', '#1f8f8a', '#e05d9c', '#56606b', '#f07f24'];
const HATS = ['#2f6fd1', '#d9412b', '#3f9b47', '#f2d43a', '#1c1c1c', '#e05d9c', '#1f8f8a', '#ffffff'];
const HAIR = ['#2a1a10', '#6b3e1f', '#e0b04a', '#b5391d', '#1c1c1c', '#8a8a8a'];
const MITTENS = ['#d9412b', '#f2d43a', '#3f9b47', '#2f6fd1', '#56606b'];
const INK = '#2b211c';

export type HeadStyle = 'beanie' | 'striped' | 'cap' | 'spiky' | 'bob';
const STYLES: HeadStyle[] = ['beanie', 'striped', 'cap', 'spiky', 'bob'];

export interface Look {
  skin: string;
  coat: string;
  hat: string;
  hair: string;
  mitten: string;
  style: HeadStyle;
  /** Head outline wobble, so each cutout looks hand-cut. */
  wobble: number[];
  buttons: boolean;
  beard: boolean;
  longHair: boolean;
}

export function lookFor(seed: number, overrides: LookOverrides = {}): Look {
  const rng = mulberry32(hashInts(seed, 0x5eed));
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  return {
    skin: pick(SKIN),
    coat: pick(COATS),
    hat: pick(HATS),
    hair: pick(HAIR),
    mitten: pick(MITTENS),
    style: pick(STYLES),
    wobble: Array.from({ length: 28 }, () => (rng() - 0.5) * 0.035),
    buttons: rng() < 0.5,
    beard: false,
    longHair: false,
    ...overrides,
  };
}

export interface Pose {
  /** Mouth open (talking, on alternate shots). */
  mouthOpen: boolean;
  /** 0 on the table, 1 high above it (dropping in). */
  lift?: number;
  /** -1 looks left, 1 looks right. */
  gaze: number;
}

function outline(ctx: Ctx2D, s: number) {
  ctx.lineWidth = 2.4 * s;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** How high the cutout is off the table; each piece's shadow scales with it. */
let lift = 0;

/**
 * One paper piece: fill with a small shadow onto whatever is beneath it
 * (the set, or the piece under it), then the cut edge.
 */
function piece(ctx: Ctx2D, fill: string, s: number) {
  ctx.save();
  ctx.shadowColor = `rgba(25,16,8,${0.3 - 0.1 * lift})`;
  ctx.shadowBlur = (4 + 30 * lift) * s;
  ctx.shadowOffsetX = (1.5 + 18 * lift) * s;
  ctx.shadowOffsetY = (3 + 34 * lift) * s;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  outline(ctx, s);
}

function blob(ctx: Ctx2D, cx: number, cy: number, r: number, wobble: number[]) {
  ctx.beginPath();
  const n = wobble.length;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + wobble[i % n]);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Draws a character in a w×h box centred on the origin, feet on the bottom edge. */
export function drawCharacter(ctx: Ctx2D, look: Look, w: number, h: number, pose: Pose): void {
  const s = Math.min(w / BASE_W, h / BASE_H);
  lift = pose.lift ?? 0;
  const floor = h / 2;
  const g = pose.gaze;

  // feet
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 34 * s, floor - 11 * s, 30 * s, 11 * s, 0, 0, Math.PI * 2);
    piece(ctx, '#2b2320', s);
  }

  // coat
  const bodyBottom = floor - 16 * s;
  const bodyTop = bodyBottom - 118 * s;
  ctx.beginPath();
  ctx.moveTo(-80 * s, bodyBottom);
  ctx.lineTo(80 * s, bodyBottom);
  ctx.lineTo(60 * s, bodyTop);
  ctx.lineTo(-60 * s, bodyTop);
  ctx.closePath();
  piece(ctx, look.coat, s);
  ctx.beginPath();
  ctx.moveTo(0, bodyTop + 8 * s);
  ctx.lineTo(0, bodyBottom);
  ctx.lineWidth = 2.4 * s;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (look.buttons) {
    ctx.fillStyle = INK;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-12 * s, bodyTop + (34 + i * 28) * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // mittens
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 82 * s, bodyBottom - 42 * s, 19 * s, 0, Math.PI * 2);
    piece(ctx, look.mitten, s);
  }

  // head
  const r = 100 * s;
  const hy = bodyTop - 66 * s;
  if (look.style === 'bob' && !look.longHair) {
    // hair behind the head (long hair draws its own)
    ctx.beginPath();
    ctx.ellipse(0, hy + 8 * s, r * 1.08, r * 1.02, 0, 0, Math.PI * 2);
    piece(ctx, look.hair, s);
  }
  if (look.longHair) {
    // falls behind the head to the shoulders
    ctx.beginPath();
    ctx.moveTo(-r * 0.98, hy - r * 0.2);
    ctx.quadraticCurveTo(-r * 1.18, hy + r * 0.9, -r * 0.72, bodyTop + 30 * s);
    ctx.lineTo(r * 0.72, bodyTop + 30 * s);
    ctx.quadraticCurveTo(r * 1.18, hy + r * 0.9, r * 0.98, hy - r * 0.2);
    ctx.closePath();
    piece(ctx, look.hair, s);
  }
  blob(ctx, 0, hy, r, look.wobble);
  piece(ctx, look.skin, s);

  if (look.beard) {
    // chin-strap beard, mouth sits on top of it
    ctx.beginPath();
    ctx.arc(0, hy, r * 0.99, Math.PI * 0.08, Math.PI * 0.92);
    ctx.quadraticCurveTo(-r * 0.5, hy + r * 0.25, 0, hy + r * 0.3);
    ctx.quadraticCurveTo(r * 0.5, hy + r * 0.25, Math.cos(Math.PI * 0.08) * r * 0.99, hy + Math.sin(Math.PI * 0.08) * r * 0.99);
    ctx.closePath();
    piece(ctx, look.hair, s);
  }

  // headwear
  const domeTop = (fill: string) => {
    ctx.beginPath();
    ctx.arc(0, hy, r * 1.01, Math.PI * 1.08, Math.PI * 1.92);
    ctx.closePath();
    piece(ctx, fill, s);
  };
  switch (look.style) {
    case 'beanie':
    case 'striped': {
      domeTop(look.hat);
      if (look.style === 'striped') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, hy, r * 0.99, Math.PI * 1.08, Math.PI * 1.92);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < 3; i++) ctx.fillRect(-r, hy - r + (14 + i * 22) * s, 2 * r, 9 * s);
        ctx.restore();
      }
      // band: a strip that follows the head's silhouette instead of a flat rectangle
      const bandTop = hy - r * 0.5;
      const bandH = 22 * s;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, hy, r * 1.03, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.rect(-r * 1.1, bandTop, r * 2.2, bandH);
      ctx.fillStyle = look.style === 'striped' ? '#ffffff' : look.mitten;
      ctx.fill();
      ctx.lineWidth = 3.2 * s;
      ctx.strokeStyle = INK;
      ctx.stroke();
      // the curved ends of the band
      ctx.beginPath();
      ctx.rect(-r * 1.1, bandTop, r * 2.2, bandH);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(0, hy, r * 1.03, 0, Math.PI * 2);
      ctx.lineWidth = 6.4 * s;
      ctx.stroke();
      ctx.restore();
      // pompom
      ctx.beginPath();
      ctx.arc(0, hy - r - 10 * s, 17 * s, 0, Math.PI * 2);
      piece(ctx, look.mitten, s);
      break;
    }
    case 'cap': {
      // hair showing under the cap: sides and a bit of fringe
      ctx.beginPath();
      for (const side of [-1, 1]) {
        ctx.moveTo(side * r * 0.62, hy - r * 0.34);
        ctx.quadraticCurveTo(side * r * 1.12, hy - r * 0.3, side * r * 0.96, hy + r * 0.12);
        ctx.quadraticCurveTo(side * r * 0.86, hy - r * 0.12, side * r * 0.6, hy - r * 0.2);
        ctx.closePath();
      }
      ctx.moveTo(-r * 0.55, hy - r * 0.3);
      ctx.quadraticCurveTo(-r * 0.2, hy - r * 0.12, r * 0.05, hy - r * 0.3);
      ctx.quadraticCurveTo(-r * 0.25, hy - r * 0.2, -r * 0.55, hy - r * 0.3);
      ctx.fillStyle = look.hair;
      ctx.fill();
      ctx.lineWidth = 2.6 * s;
      ctx.strokeStyle = INK;
      ctx.stroke();
      domeTop(look.hat);
      ctx.beginPath();
      ctx.ellipse(g * r * 0.62, hy - r * 0.34, r * 0.62, 12 * s, 0, 0, Math.PI * 2);
      piece(ctx, look.hat, s);
      break;
    }
    case 'spiky': {
      ctx.beginPath();
      const spikes = 7;
      ctx.moveTo(-r * 0.95, hy - r * 0.3);
      for (let i = 0; i <= spikes; i++) {
        const a = Math.PI * (1.05 + (0.9 * i) / spikes);
        const tipR = i % 2 === 0 ? r * 1.22 : r * 0.98;
        ctx.lineTo(Math.cos(a) * tipR, hy + Math.sin(a) * tipR);
      }
      ctx.lineTo(r * 0.95, hy - r * 0.3);
      ctx.quadraticCurveTo(0, hy - r * 0.55, -r * 0.95, hy - r * 0.3);
      ctx.closePath();
      piece(ctx, look.hair, s);
      break;
    }
    case 'bob': {
      // side-swept fringe over the crown, parted to one side
      ctx.beginPath();
      ctx.arc(0, hy, r * 1.01, Math.PI * 1.03, Math.PI * 1.97);
      ctx.quadraticCurveTo(r * 0.62, hy - r * 0.62, r * 0.08, hy - r * 0.5);
      ctx.quadraticCurveTo(-r * 0.62, hy - r * 0.42, -r * 0.99, hy - r * 0.08);
      ctx.closePath();
      piece(ctx, look.hair, s);
      break;
    }
  }

  // eyes: two touching ovals, pupils toward the gaze
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 25 * s, hy - 8 * s, 26 * s, 31 * s, side * 0.18, 0, Math.PI * 2);
    piece(ctx, '#ffffff', s);
    ctx.beginPath();
    ctx.arc(side * 11 * s + g * 9 * s, hy - 6 * s, 5.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }

  // mouth
  const my = hy + 48 * s;
  const mx = g * 6 * s;
  if (pose.mouthOpen) {
    ctx.beginPath();
    ctx.ellipse(mx, my, 17 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(mx - 15 * s, my - 2 * s);
    if (look.beard) {
      ctx.quadraticCurveTo(mx, my + 5 * s, mx + 15 * s, my - 2 * s);
      ctx.lineWidth = 7 * s;
      ctx.strokeStyle = look.skin;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 15 * s, my - 2 * s);
    }
    ctx.quadraticCurveTo(mx, my + 5 * s, mx + 15 * s, my - 2 * s);
    ctx.lineWidth = 3.2 * s;
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
