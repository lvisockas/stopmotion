import { rngFor } from './prng';
import { HEIGHT, WIDTH, type Ctx2D, type PropKind } from './types';

/** Size at scale 1, in frame pixels. */
export const PROP_SIZE: Record<PropKind, [number, number]> = {
  plane: [560, 210],
  boat: [330, 170],
  iceberg: [300, 200],
  suitcase: [130, 150],
  flag: [170, 300],
  dog: [190, 170],
  'dog-hut': [180, 150],
  table: [1000, 240],
  cake: [200, 190],
  coffee: [100, 100],
  pumpkin: [150, 130],
  'cargo-bike': [470, 270],
  goat: [190, 170],
  snow: [WIDTH, HEIGHT],
};

const INK = '#1b1714';

function cut(ctx: Ctx2D, fill: string, width = 3) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function ellipse(ctx: Ctx2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function rect(ctx: Ctx2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
}

type Painter = (ctx: Ctx2D, w: number, h: number, step: number) => void;

const PAINTERS: Record<Exclude<PropKind, 'snow'>, Painter> = {
  plane(ctx, w, h) {
    const k = w / 560;
    // tail fin (Air Greenland red)
    ctx.beginPath();
    ctx.moveTo(-230 * k, -10 * k);
    ctx.lineTo(-270 * k, -95 * k);
    ctx.lineTo(-215 * k, -95 * k);
    ctx.lineTo(-160 * k, -12 * k);
    ctx.closePath();
    cut(ctx, '#d0262d');
    // fuselage
    ellipse(ctx, 0, 0, 270 * k, 48 * k);
    cut(ctx, '#ffffff');
    ctx.beginPath();
    ctx.moveTo(-250 * k, 18 * k);
    ctx.quadraticCurveTo(0, 60 * k, 262 * k, 12 * k);
    ctx.lineTo(262 * k, 20 * k);
    ctx.quadraticCurveTo(0, 50 * k, -240 * k, 30 * k);
    ctx.closePath();
    ctx.fillStyle = '#d0262d';
    ctx.fill();
    // wing
    ctx.beginPath();
    ctx.moveTo(-40 * k, 10 * k);
    ctx.lineTo(-120 * k, 95 * k);
    ctx.lineTo(-60 * k, 95 * k);
    ctx.lineTo(60 * k, 12 * k);
    ctx.closePath();
    cut(ctx, '#e9eef2');
    // windows
    ctx.fillStyle = '#4b6f8f';
    for (let i = 0; i < 9; i++) {
      ellipse(ctx, (-150 + i * 34) * k, -10 * k, 9 * k, 11 * k);
      ctx.fill();
    }
    ellipse(ctx, 225 * k, -12 * k, 22 * k, 13 * k, -0.3);
    cut(ctx, '#4b6f8f', 2);
    void h;
  },
  boat(ctx, w) {
    const k = w / 330;
    ctx.beginPath();
    ctx.moveTo(-165 * k, 10 * k);
    ctx.lineTo(165 * k, 10 * k);
    ctx.lineTo(120 * k, 80 * k);
    ctx.lineTo(-140 * k, 80 * k);
    ctx.closePath();
    cut(ctx, '#c8352b');
    rect(ctx, -90 * k, -60 * k, 150 * k, 70 * k);
    cut(ctx, '#ffffff');
    ctx.fillStyle = '#3f6f98';
    for (const x of [-75, -30, 15]) {
      rect(ctx, x * k, -45 * k, 32 * k, 26 * k);
      ctx.fill();
    }
    rect(ctx, -10 * k, -85 * k, 16 * k, 26 * k);
    cut(ctx, '#2d2a2e');
  },
  iceberg(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w * 0.36, -h * 0.05);
    ctx.lineTo(-w * 0.18, -h * 0.18);
    ctx.lineTo(-w * 0.05, -h / 2);
    ctx.lineTo(w * 0.12, -h * 0.25);
    ctx.lineTo(w * 0.3, -h * 0.32);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
    cut(ctx, '#f7fbfd');
    ctx.beginPath();
    ctx.moveTo(-w * 0.05, -h / 2);
    ctx.lineTo(w * 0.12, -h * 0.25);
    ctx.lineTo(w * 0.3, -h * 0.32);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(w * 0.05, h / 2);
    ctx.closePath();
    ctx.fillStyle = '#bfe0ee';
    ctx.fill();
  },
  suitcase(ctx, w, h) {
    rect(ctx, -w * 0.18, -h / 2, w * 0.36, h * 0.18);
    cut(ctx, '#2d2a2e');
    ctx.beginPath();
    ctx.roundRect?.(-w / 2, -h * 0.34, w, h * 0.84, 12);
    if (!ctx.roundRect) rect(ctx, -w / 2, -h * 0.34, w, h * 0.84);
    cut(ctx, '#e8b52a');
    ctx.fillStyle = '#c8352b';
    ellipse(ctx, -w * 0.18, h * 0.05, w * 0.14, w * 0.1);
    ctx.fill();
    ctx.fillStyle = '#2f67b3';
    rect(ctx, w * 0.05, h * 0.16, w * 0.3, h * 0.12);
    ctx.fill();
  },
  flag(ctx, w, h) {
    // pole
    rect(ctx, -w / 2, -h / 2, 10, h);
    cut(ctx, '#d9d4ca', 2);
    // Greenland's flag: white over red, counterchanged disc left of centre
    const fx = -w / 2 + 10;
    const fy = -h / 2 + 8;
    const fw = w - 14;
    const fh = fw * (2 / 3);
    rect(ctx, fx, fy, fw, fh / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    rect(ctx, fx, fy + fh / 2, fw, fh / 2);
    ctx.fillStyle = '#d0262d';
    ctx.fill();
    const cx = fx + fw * (7 / 18);
    const cy = fy + fh / 2;
    const r = fh / 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#d0262d';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    rect(ctx, fx, fy, fw, fh);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  },
  dog(ctx, w) {
    const k = w / 190;
    // sitting husky: body, head, ears, curled tail
    ellipse(ctx, 50 * k, 20 * k, 30 * k, 18 * k, -0.6);
    cut(ctx, '#8d949b');
    ellipse(ctx, 0, 25 * k, 62 * k, 55 * k);
    cut(ctx, '#8d949b');
    ellipse(ctx, -5 * k, 40 * k, 35 * k, 38 * k);
    ctx.fillStyle = '#f4f4f2';
    ctx.fill();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo((-30 + side * 26) * k, -60 * k);
      ctx.lineTo((-30 + side * 40) * k, -100 * k);
      ctx.lineTo((-30 + side * 8) * k, -72 * k);
      ctx.closePath();
      cut(ctx, '#6f767d');
    }
    ellipse(ctx, -30 * k, -48 * k, 44 * k, 38 * k);
    cut(ctx, '#8d949b');
    ellipse(ctx, -30 * k, -36 * k, 28 * k, 24 * k);
    ctx.fillStyle = '#f4f4f2';
    ctx.fill();
    ctx.fillStyle = INK;
    for (const side of [-1, 1]) {
      ellipse(ctx, (-30 + side * 14) * k, -56 * k, 5 * k, 6 * k);
      ctx.fill();
    }
    ellipse(ctx, -30 * k, -38 * k, 8 * k, 6 * k);
    ctx.fill();
  },
  'dog-hut'(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, -h * 0.05);
    ctx.lineTo(0, -h / 2);
    ctx.lineTo(w / 2, -h * 0.05);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
    cut(ctx, '#8a5a36');
    ctx.beginPath();
    ctx.arc(0, h / 2, w * 0.2, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#2d2016';
    ctx.fill();
  },
  table(ctx, w, h) {
    rect(ctx, -w / 2, -h / 2, w, h * 0.3);
    cut(ctx, '#fbf8f1');
    rect(ctx, -w / 2 + 10, -h / 2 + h * 0.3, w - 20, h * 0.7 + 20);
    cut(ctx, '#7a4a2a');
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let x = -w / 2 + 60; x < w / 2; x += 90) ctx.fillRect(x, -h / 2 + h * 0.34, 4, h * 0.6);
  },
  cake(ctx, w, h, step) {
    const k = w / 200;
    rect(ctx, -90 * k, 10 * k, 180 * k, 80 * k);
    cut(ctx, '#f3c6d3');
    rect(ctx, -90 * k, 10 * k, 180 * k, 22 * k);
    cut(ctx, '#ffffff');
    ellipse(ctx, 0, 92 * k, 110 * k, 10 * k);
    cut(ctx, '#e6e6e6', 2);
    // candles with stop-motion flicker
    for (const x of [-50, -15, 20, 55]) {
      rect(ctx, (x - 6) * k, -40 * k, 12 * k, 50 * k);
      cut(ctx, x % 2 ? '#2f67b3' : '#e8b52a', 2);
      const f = rngFor(step, x + 100)();
      ctx.beginPath();
      ctx.moveTo(x * k, (-72 - f * 8) * k);
      ctx.quadraticCurveTo((x + 11) * k, -50 * k, x * k, -42 * k);
      ctx.quadraticCurveTo((x - 11) * k, -50 * k, x * k, (-72 - f * 8) * k);
      ctx.fillStyle = '#ffb21d';
      ctx.fill();
    }
    void h;
  },
  coffee(ctx, w, h) {
    ctx.beginPath();
    ctx.arc(w * 0.34, 0, w * 0.16, -Math.PI / 2, Math.PI / 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.36, -h * 0.3);
    ctx.lineTo(w * 0.34, -h * 0.3);
    ctx.lineTo(w * 0.26, h * 0.4);
    ctx.lineTo(-w * 0.28, h * 0.4);
    ctx.closePath();
    cut(ctx, '#ffffff');
    ellipse(ctx, 0, -h * 0.3, w * 0.35, h * 0.07);
    cut(ctx, '#6b3e1f', 2);
  },
  pumpkin(ctx, w, h) {
    for (const dx of [-0.25, 0.25, 0]) {
      ellipse(ctx, dx * w, 0, w * 0.32, h * 0.42);
      cut(ctx, '#f07f24');
    }
    rect(ctx, -6, -h / 2 - 8, 12, 22);
    cut(ctx, '#3e8c4a', 2);
    ctx.fillStyle = INK;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * w * 0.18, -h * 0.12);
      ctx.lineTo(side * w * 0.08, h * 0.02);
      ctx.lineTo(side * w * 0.28, h * 0.02);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, h * 0.14);
    ctx.lineTo(w * 0.2, h * 0.14);
    ctx.lineTo(0, h * 0.28);
    ctx.closePath();
    ctx.fill();
  },
  'cargo-bike'(ctx, w, h) {
    const k = w / 470;
    ctx.lineWidth = 7 * k;
    ctx.strokeStyle = INK;
    for (const x of [-170, 170]) {
      ellipse(ctx, x * k, 80 * k, 52 * k, 52 * k);
      ctx.stroke();
    }
    // frame
    ctx.beginPath();
    ctx.moveTo(-170 * k, 80 * k);
    ctx.lineTo(60 * k, 80 * k);
    ctx.lineTo(120 * k, -20 * k);
    ctx.lineTo(170 * k, 80 * k);
    ctx.moveTo(60 * k, 80 * k);
    ctx.lineTo(80 * k, -30 * k);
    ctx.moveTo(120 * k, -20 * k);
    ctx.lineTo(110 * k, -80 * k);
    ctx.lineWidth = 9 * k;
    ctx.strokeStyle = '#2f67b3';
    ctx.stroke();
    rect(ctx, 50 * k, -42 * k, 60 * k, 14 * k);
    cut(ctx, INK, 2);
    rect(ctx, 90 * k, -92 * k, 50 * k, 12 * k);
    cut(ctx, INK, 2);
    // wooden box
    ctx.beginPath();
    ctx.moveTo(-235 * k, -60 * k);
    ctx.lineTo(-40 * k, -60 * k);
    ctx.lineTo(-60 * k, 50 * k);
    ctx.lineTo(-215 * k, 50 * k);
    ctx.closePath();
    cut(ctx, '#c89a62');
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    for (const y of [-25, 10]) {
      ctx.beginPath();
      ctx.moveTo(-228 * k, y * k);
      ctx.lineTo(-48 * k, y * k);
      ctx.stroke();
    }
    void h;
  },
  goat(ctx, w) {
    const k = w / 190;
    ctx.lineWidth = 8 * k;
    ctx.strokeStyle = INK;
    for (const x of [-45, -20, 30, 55]) {
      ctx.beginPath();
      ctx.moveTo(x * k, 20 * k);
      ctx.lineTo(x * k, 80 * k);
      ctx.stroke();
    }
    ellipse(ctx, 5 * k, 5 * k, 75 * k, 42 * k);
    cut(ctx, '#f4f1ea');
    ellipse(ctx, 75 * k, -40 * k, 30 * k, 26 * k, -0.4);
    cut(ctx, '#f4f1ea');
    ctx.beginPath();
    ctx.moveTo(70 * k, -62 * k);
    ctx.quadraticCurveTo(55 * k, -100 * k, 35 * k, -92 * k);
    ctx.lineWidth = 7 * k;
    ctx.strokeStyle = '#8a7a66';
    ctx.stroke();
    ctx.fillStyle = INK;
    ellipse(ctx, 85 * k, -46 * k, 4 * k, 5 * k);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(90 * k, -18 * k);
    ctx.lineTo(96 * k, 4 * k);
    ctx.lineTo(84 * k, -14 * k);
    ctx.closePath();
    ctx.fillStyle = '#d9d4ca';
    ctx.fill();
  },
};

/** Draws a prop in a w×h box centred on the origin. */
export function drawProp(ctx: Ctx2D, kind: Exclude<PropKind, 'snow'>, w: number, h: number, step: number): void {
  PAINTERS[kind](ctx, w, h, step);
}

/**
 * Falling snow for the whole frame, in frame coordinates. Each flake falls
 * at its own speed and wraps; positions depend only on (seed, time), so
 * it animates at the stop-motion rate like everything else.
 */
export function drawSnow(ctx: Ctx2D, seed: number, time: number, density = 1): void {
  const rng = rngFor(seed, 0x5a0);
  const n = Math.round(90 * density);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let i = 0; i < n; i++) {
    const x0 = rng() * WIDTH;
    const y0 = rng() * HEIGHT;
    const r = 3 + rng() * 6;
    const speed = 50 + r * 14;
    const sway = rng() * Math.PI * 2;
    const y = (y0 + time * speed) % (HEIGHT + 20);
    const x = x0 + Math.sin(time * 1.3 + sway) * 14;
    ctx.beginPath();
    ctx.arc(x, y - 10, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
