import { hashInts, mulberry32 } from './prng';
import { cachedTexture } from './textures';
import { HEIGHT, WIDTH, type Ctx2D, type DrawableImage, type SceneKind } from './types';

/**
 * Cut-paper backdrops. Each is a stack of flat paper layers with a soft
 * shadow between them, generated from the slide seed and cached, so a
 * scene costs one drawImage per frame. The ground band sits at the bottom
 * where the characters stand (their feet are at y ≈ 1286).
 */

type Rng = () => number;

/** Fills the current path as a paper layer: flat colour, faint cut edge, shadow onto the layer below. */
function layer(ctx: Ctx2D, fill: string, shadow = 0.22) {
  ctx.save();
  ctx.shadowColor = `rgba(20,14,8,${shadow})`;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.stroke();
}

function sky(ctx: Ctx2D, top: string, bottom: string, bands = 5) {
  // stepped paper bands, not a smooth gradient
  const lerp = (a: string, b: string, t: number) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
  };
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = lerp(top, bottom, i / (bands - 1));
    ctx.fillRect(0, (HEIGHT * 0.75 * i) / bands, WIDTH, HEIGHT);
  }
}

/** A ridge line across the frame: jagged polygon from x=0 to WIDTH, closed down to the bottom. */
function ridge(ctx: Ctx2D, rng: Rng, baseY: number, amp: number, steps: number, fill: string, shadow?: number) {
  ctx.beginPath();
  ctx.moveTo(-20, HEIGHT + 20);
  for (let i = 0; i <= steps; i++) {
    const x = -20 + ((WIDTH + 40) * i) / steps;
    ctx.lineTo(x, baseY - rng() * amp);
  }
  ctx.lineTo(WIDTH + 20, HEIGHT + 20);
  ctx.closePath();
  layer(ctx, fill, shadow);
}

function cloud(ctx: Ctx2D, x: number, y: number, s: number, fill = '#ffffff') {
  ctx.beginPath();
  for (const [dx, dy, r] of [[-60, 10, 42], [-10, -18, 56], [50, 4, 46], [0, 24, 40], [90, 22, 30], [-100, 26, 28]]) {
    ctx.moveTo(x + dx * s + r * s, y + dy * s);
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
  }
  layer(ctx, fill, 0.12);
}

function iceberg(ctx: Ctx2D, rng: Rng, x: number, baseY: number, w: number, h: number) {
  const pts: [number, number][] = [[x - w / 2, baseY]];
  const n = 5 + Math.floor(rng() * 3);
  for (let i = 1; i < n; i++) {
    pts.push([x - w / 2 + (w * i) / n + (rng() - 0.5) * w * 0.08, baseY - h * (0.45 + rng() * 0.55)]);
  }
  pts.push([x + w / 2, baseY]);
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  layer(ctx, '#f7fbfd', 0.25);
  // shaded blue face
  ctx.beginPath();
  const mid = pts[Math.floor(pts.length / 2)];
  ctx.moveTo(mid[0], mid[1]);
  for (const p of pts.slice(Math.floor(pts.length / 2))) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(mid[0] + w * 0.05, baseY);
  ctx.closePath();
  ctx.fillStyle = '#bfe0ee';
  ctx.fill();
}

function house(ctx: Ctx2D, x: number, groundY: number, w: number, h: number, colour: string, lit = false) {
  ctx.beginPath();
  ctx.rect(x, groundY - h, w, h);
  layer(ctx, colour, 0.2);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.08, groundY - h);
  ctx.lineTo(x + w / 2, groundY - h - h * 0.55);
  ctx.lineTo(x + w * 1.08, groundY - h);
  ctx.closePath();
  layer(ctx, '#2d2a2e', 0.2);
  ctx.fillStyle = lit ? '#ffd966' : '#ffffff';
  const ww = w * 0.2;
  for (const fx of [0.2, 0.6]) ctx.fillRect(x + w * fx, groundY - h * 0.7, ww, ww);
}

function stars(ctx: Ctx2D, rng: Rng, n: number, maxY: number) {
  ctx.fillStyle = '#fffbe6';
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(rng() * WIDTH, rng() * maxY, 1 + rng() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

const TOWN_COLOURS = ['#c8352b', '#e8b52a', '#2f67b3', '#3e8c4a', '#d9622b', '#7fb5d6', '#a83f6c'];

function groundSnow(ctx: Ctx2D, rng: Rng, y = 1150) {
  ridge(ctx, rng, y, 40, 8, '#f3f6f8', 0.25);
}

const SCENE_PAINTERS: Record<Exclude<SceneKind, 'none'>, (ctx: Ctx2D, rng: Rng) => void> = {
  sky(ctx, rng) {
    sky(ctx, '#7cc2ea', '#d9f0fb');
    ctx.beginPath();
    ctx.arc(860, 230, 70, 0, Math.PI * 2);
    layer(ctx, '#ffd84d', 0.1);
    for (let i = 0; i < 5; i++) cloud(ctx, 100 + rng() * 880, 180 + rng() * 650, 0.7 + rng() * 0.6);
    // cloud floor to stand on
    ctx.beginPath();
    for (let x = -40; x < WIDTH + 80; x += 90) {
      const r = 70 + rng() * 40;
      ctx.moveTo(x + r, 1230);
      ctx.arc(x, 1230, r, 0, Math.PI * 2);
    }
    ctx.rect(-20, 1230, WIDTH + 40, 200);
    layer(ctx, '#ffffff', 0.18);
  },
  icefjord(ctx, rng) {
    sky(ctx, '#a9d4ec', '#e6f3fa');
    ridge(ctx, rng, 640, 110, 9, '#8aa4b8', 0.12);
    ridge(ctx, rng, 690, 60, 12, '#b9c9d4', 0.12);
    ctx.beginPath();
    ctx.rect(-20, 690, WIDTH + 40, HEIGHT);
    layer(ctx, '#2f6f98', 0.15);
    ctx.beginPath();
    ctx.rect(-20, 860, WIDTH + 40, HEIGHT);
    layer(ctx, '#245d84', 0.15);
    const bergs = 6;
    for (let i = 0; i < bergs; i++) {
      const x = 60 + ((WIDTH - 120) * (i + rng() * 0.6)) / bergs;
      const y = 720 + rng() * 300;
      const s = 0.5 + ((y - 700) / 320) * 0.8;
      iceberg(ctx, rng, x, y, 150 * s + rng() * 80, 90 * s + rng() * 60);
    }
    // rocky shore
    ridge(ctx, rng, 1150, 60, 7, '#5b5550', 0.3);
    ridge(ctx, rng, 1215, 30, 9, '#6e675f', 0.3);
  },
  town(ctx, rng) {
    sky(ctx, '#9fcbe6', '#e3f1f8');
    ridge(ctx, rng, 760, 140, 7, '#7d8a86', 0.15);
    ctx.beginPath();
    ctx.rect(-20, 760, WIDTH + 40, HEIGHT);
    layer(ctx, '#2f6f98', 0.1);
    ridge(ctx, rng, 930, 90, 6, '#6f6a60', 0.25);
    for (let i = 0; i < 9; i++) {
      const x = 20 + rng() * (WIDTH - 110);
      const g = 900 + rng() * 150;
      house(ctx, x, g, 70 + rng() * 40, 55 + rng() * 30, TOWN_COLOURS[i % TOWN_COLOURS.length]);
    }
    ridge(ctx, rng, 1130, 40, 8, '#77706a', 0.3);
    // boardwalk
    ctx.beginPath();
    ctx.rect(-20, 1225, WIDTH + 40, 140);
    layer(ctx, '#9b6b43', 0.3);
    ctx.strokeStyle = 'rgba(60,35,15,0.45)';
    ctx.lineWidth = 3;
    for (let x = 0; x < WIDTH; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 1228);
      ctx.lineTo(x - 10, HEIGHT);
      ctx.stroke();
    }
  },
  'mountain-town'(ctx, rng) {
    sky(ctx, '#b7d3e6', '#eef5f9');
    // one big dark mountain with a snow cap
    ctx.beginPath();
    ctx.moveTo(140, 900);
    ctx.lineTo(430, 330);
    ctx.lineTo(560, 470);
    ctx.lineTo(640, 400);
    ctx.lineTo(1000, 900);
    ctx.closePath();
    layer(ctx, '#3f4a55', 0.2);
    ctx.beginPath();
    ctx.moveTo(360, 470);
    ctx.lineTo(430, 330);
    ctx.lineTo(560, 470);
    ctx.lineTo(640, 400);
    ctx.lineTo(720, 510);
    ctx.lineTo(600, 490);
    ctx.lineTo(520, 520);
    ctx.lineTo(450, 480);
    ctx.closePath();
    layer(ctx, '#f4f7f9', 0.1);
    ctx.beginPath();
    ctx.rect(-20, 850, WIDTH + 40, HEIGHT);
    layer(ctx, '#2c6a92', 0.12);
    ridge(ctx, rng, 1000, 70, 6, '#6d665d', 0.25);
    for (let i = 0; i < 8; i++) {
      house(ctx, 30 + i * 128 + rng() * 30, 990 + rng() * 60, 80, 62 + rng() * 25, TOWN_COLOURS[(i * 3) % TOWN_COLOURS.length]);
    }
    groundSnow(ctx, rng, 1190);
  },
  snowfield(ctx, rng) {
    sky(ctx, '#c9d6e0', '#eef2f5');
    ridge(ctx, rng, 720, 160, 6, '#d9e2e9', 0.12);
    ridge(ctx, rng, 860, 110, 7, '#e9eef2', 0.15);
    // rocky outcrops
    for (let i = 0; i < 4; i++) {
      const x = rng() * WIDTH;
      const y = 880 + rng() * 150;
      ctx.beginPath();
      ctx.moveTo(x - 80, y);
      ctx.lineTo(x - 30, y - 50 - rng() * 30);
      ctx.lineTo(x + 40, y - 40);
      ctx.lineTo(x + 90, y);
      ctx.closePath();
      layer(ctx, '#6f6a64', 0.2);
    }
    groundSnow(ctx, rng, 1060);
    groundSnow(ctx, rng, 1180);
  },
  aurora(ctx, rng) {
    sky(ctx, '#0b1330', '#1d2f55', 6);
    stars(ctx, rng, 140, 800);
    // aurora ribbons: translucent green paper strips
    for (let i = 0; i < 3; i++) {
      const y0 = 250 + i * 110 + rng() * 60;
      ctx.beginPath();
      ctx.moveTo(-40, y0 + 120);
      ctx.bezierCurveTo(250, y0 - 120 - rng() * 80, 650, y0 + 160, WIDTH + 40, y0 - 60);
      ctx.lineTo(WIDTH + 40, y0 + 40);
      ctx.bezierCurveTo(650, y0 + 260, 250, y0 - 20, -40, y0 + 220);
      ctx.closePath();
      ctx.fillStyle = i === 1 ? 'rgba(120,240,170,0.55)' : 'rgba(80,220,150,0.35)';
      ctx.fill();
    }
    ridge(ctx, rng, 900, 120, 7, '#1c2638', 0.3);
    for (let i = 0; i < 5; i++) house(ctx, 80 + i * 200 + rng() * 60, 1000 + rng() * 40, 70, 55, '#3b3f55', true);
    ridge(ctx, rng, 1150, 40, 8, '#c9d6ea', 0.35);
  },
  room(ctx) {
    // warm wall, a big window onto the icefjord, a floor
    ctx.fillStyle = '#e9d5b3';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = 'rgba(160,120,70,0.12)';
    for (let x = 0; x < WIDTH; x += 70) ctx.fillRect(x, 0, 6, HEIGHT);
    const win = { x: 150, y: 170, w: 780, h: 560 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.clip();
    ctx.translate(win.x - 150, win.y - 170);
    ctx.scale(win.w / WIDTH, win.h / 900);
    SCENE_PAINTERS.icefjord(ctx, mulberry32(99));
    ctx.restore();
    ctx.beginPath();
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.lineWidth = 28;
    ctx.strokeStyle = '#f7f2ea';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(win.x + win.w / 2, win.y);
    ctx.lineTo(win.x + win.w / 2, win.y + win.h);
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-20, 1120, WIDTH + 40, 300);
    layer(ctx, '#8a5a36', 0.3);
  },
  canal(ctx, rng) {
    sky(ctx, '#a7cde8', '#e8f2f9');
    const colours = ['#c8352b', '#e8a52a', '#2f67b3', '#e7d46a', '#d9622b', '#5f9e8f', '#b9443b', '#f0c97a'];
    let x = -30;
    let i = 0;
    while (x < WIDTH + 20) {
      const w = 110 + rng() * 40;
      const h = 380 + rng() * 170;
      const base = 860;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, base - h);
      ctx.lineTo(x + w / 2, base - h - 70);
      ctx.lineTo(x + w, base - h);
      ctx.lineTo(x + w, base);
      ctx.closePath();
      layer(ctx, colours[i % colours.length], 0.2);
      ctx.fillStyle = '#f5f2ea';
      for (let fy = base - h + 40; fy < base - 60; fy += 78) {
        for (const fx of [0.18, 0.58]) ctx.fillRect(x + w * fx, fy, w * 0.24, 44);
      }
      x += w + 4;
      i++;
    }
    ctx.beginPath();
    ctx.rect(-20, 860, WIDTH + 40, 300);
    layer(ctx, '#2e5f7d', 0.15);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 4;
    for (let k = 0; k < 10; k++) {
      const wx = rng() * WIDTH;
      const wy = 900 + rng() * 200;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + 60, wy);
      ctx.stroke();
    }
    // cobbled quay
    ctx.beginPath();
    ctx.rect(-20, 1150, WIDTH + 40, 260);
    layer(ctx, '#8d8680', 0.35);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let k = 0; k < 60; k++) ctx.fillRect(rng() * WIDTH, 1165 + rng() * 180, 30, 14);
  },
};

export function sceneTexture(kind: Exclude<SceneKind, 'none'>, seed: number): DrawableImage {
  return cachedTexture(`scene|${kind}|${seed}`, WIDTH, HEIGHT, (ctx) => {
    SCENE_PAINTERS[kind](ctx, mulberry32(hashInts(seed, 0x5ce9e)));
  });
}
