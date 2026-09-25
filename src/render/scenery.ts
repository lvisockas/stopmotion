import { hashInts, mulberry32 } from './prng';
import { cachedTexture, paperTexture } from './textures';
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

function sky(ctx: Ctx2D, top: string, bottom: string, _bands = 5) {
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.8);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** A ridge line across the frame, torn rather than cut: coarse shape, fine ragged edge, white paper core showing along the top. */
function ridge(ctx: Ctx2D, rng: Rng, baseY: number, amp: number, steps: number, fill: string, shadow = 0.22) {
  const coarse: [number, number][] = [];
  for (let i = 0; i <= steps; i++) coarse.push([-30 + ((WIDTH + 60) * i) / steps, baseY - rng() * amp]);
  const edge: [number, number][] = [];
  for (let i = 0; i < coarse.length - 1; i++) {
    const [x0, y0] = coarse[i];
    const [x1, y1] = coarse[i + 1];
    const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 14));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      edge.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + (rng() - 0.5) * 4.5]);
    }
  }
  edge.push(coarse[coarse.length - 1]);
  const trace = (dy: number) => {
    ctx.beginPath();
    ctx.moveTo(-40, HEIGHT + 40);
    for (const [x, y] of edge) ctx.lineTo(x, y + dy);
    ctx.lineTo(WIDTH + 40, HEIGHT + 40);
    ctx.closePath();
  };
  // torn core: a pale rim just above the coloured layer, carrying the shadow
  trace(-3.5);
  ctx.save();
  ctx.shadowColor = `rgba(20,14,8,${shadow})`;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#f3efe5';
  ctx.fill();
  ctx.restore();
  trace(0);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Adds circles to the current path; filled together they make one silhouette. */
function puffs(ctx: Ctx2D, circles: [number, number, number][]) {
  for (const [x, y, r] of circles) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

/** A cut-paper cloud: one silhouette (no seams between puffs), a soft shadow and a shaded underside. */
function paperCloud(ctx: Ctx2D, circles: [number, number, number][], shade = '#dde9f1') {
  const bottom = Math.max(...circles.map(([, y, r]) => y + r));
  const top = Math.min(...circles.map(([, y, r]) => y - r));
  ctx.save();
  ctx.beginPath();
  puffs(ctx, circles);
  ctx.shadowColor = 'rgba(40,60,80,0.18)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  puffs(ctx, circles);
  ctx.clip();
  const g = ctx.createLinearGradient(0, top + (bottom - top) * 0.45, 0, bottom);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.fillRect(-100, top, WIDTH + 200, bottom - top);
  ctx.restore();
}

function cloud(ctx: Ctx2D, x: number, y: number, s: number) {
  paperCloud(
    ctx,
    [[-60, 10, 42], [-10, -18, 56], [50, 4, 46], [0, 24, 40], [90, 22, 30], [-100, 26, 28]].map(
      ([dx, dy, r]) => [x + dx * s, y + dy * s, r * s] as [number, number, number],
    ),
  );
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
    // cloud floor to stand on: two banks, the far one bluer
    for (const [y, shade] of [[1170, '#cfe0ec'], [1250, '#e2edf4']] as const) {
      const circles: [number, number, number][] = [];
      for (let x = -60; x < WIDTH + 100; x += 80 + rng() * 30) circles.push([x, y, 60 + rng() * 45]);
      circles.push([WIDTH / 2, y + 400, 480], [0, y + 250, 260], [WIDTH, y + 250, 260]);
      paperCloud(ctx, circles, shade);
    }
  },
  icefjord(ctx, rng) {
    sky(ctx, '#a9d4ec', '#e6f3fa');
    ridge(ctx, rng, 640, 110, 9, '#8aa4b8', 0.12);
    ridge(ctx, rng, 690, 60, 12, '#b9c9d4', 0.12);
    ridge(ctx, rng, 692, 4, 10, '#2f6f98', 0.15);
    ridge(ctx, rng, 862, 5, 10, '#245d84', 0.15);
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
    ridge(ctx, rng, 762, 4, 10, '#2f6f98', 0.1);
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
    ridge(ctx, rng, 852, 4, 10, '#2c6a92', 0.12);
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
    ctx.translate(win.x, win.y);
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
  shopfront(ctx, rng) {
    sky(ctx, '#b9d3e4', '#e6eff5');
    // neighbouring facades
    ctx.beginPath();
    ctx.rect(-20, 0, 200, 1160);
    layer(ctx, '#d9b25a', 0.2);
    ctx.beginPath();
    ctx.rect(WIDTH - 180, 0, 200, 1160);
    layer(ctx, '#b9443b', 0.2);
    // the shop: dark green facade
    ctx.beginPath();
    ctx.rect(150, 0, WIDTH - 300, 1170);
    layer(ctx, '#2f5a4a', 0.3);
    // upper-floor windows
    ctx.fillStyle = '#f2ede2';
    for (const x of [240, 470, 700]) ctx.fillRect(x, 60, 130, 150);
    // sign board, hand-painted
    ctx.beginPath();
    ctx.rect(250, 270, WIDTH - 500, 110);
    layer(ctx, '#f4efe6', 0.3);
    ctx.fillStyle = '#2f5a4a';
    ctx.font = '400 84px "Patrick Hand", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VINTAGE', WIDTH / 2, 330);
    // striped awning
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(170, 400);
    ctx.lineTo(WIDTH - 170, 400);
    ctx.lineTo(WIDTH - 140, 500);
    for (let x = WIDTH - 140; x > 140; x -= 60) ctx.quadraticCurveTo(x - 30, 540, x - 60, 500);
    ctx.closePath();
    layer(ctx, '#f4efe6', 0.35);
    ctx.clip();
    ctx.fillStyle = '#c8352b';
    for (let x = 170; x < WIDTH; x += 120) ctx.fillRect(x, 390, 60, 160);
    ctx.restore();
    // shop window with hanging clothes
    ctx.beginPath();
    ctx.rect(210, 560, 420, 500);
    layer(ctx, '#e9eef0', 0.25);
    const colours = ['#c8352b', '#e8b52a', '#2f67b3', '#e05d9c', '#3e8c4a'];
    for (let i = 0; i < 5; i++) {
      const x = 260 + i * 78;
      ctx.beginPath();
      ctx.moveTo(x - 30, 640);
      ctx.lineTo(x + 30, 640);
      ctx.lineTo(x + 36 + rng() * 8, 800 + rng() * 60);
      ctx.lineTo(x - 36 - rng() * 8, 800 + rng() * 60);
      ctx.closePath();
      layer(ctx, colours[i], 0.25);
    }
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(220, 620, 400, 6);
    // door
    ctx.beginPath();
    ctx.rect(690, 560, 190, 610);
    layer(ctx, '#1f3d33', 0.3);
    ctx.fillStyle = '#e9eef0';
    ctx.fillRect(715, 590, 140, 250);
    ctx.fillStyle = '#e8b52a';
    ctx.beginPath();
    ctx.arc(855, 900, 9, 0, Math.PI * 2);
    ctx.fill();
    // pavement
    ridge(ctx, rng, 1160, 5, 10, '#9a938b', 0.35);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let k = 0; k < 50; k++) ctx.fillRect(rng() * WIDTH, 1180 + rng() * 170, 34, 14);
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
    ridge(ctx, rng, 862, 4, 10, '#2e5f7d', 0.15);
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
    ridge(ctx, rng, 1152, 6, 10, '#8d8680', 0.35);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let k = 0; k < 60; k++) ctx.fillRect(rng() * WIDTH, 1165 + rng() * 180, 30, 14);
  },
};

export function sceneTexture(kind: Exclude<SceneKind, 'none'>, seed: number): DrawableImage {
  return cachedTexture(`scene|${kind}|${seed}`, WIDTH, HEIGHT, (ctx) => {
    SCENE_PAINTERS[kind](ctx, mulberry32(hashInts(seed, 0x5ce9e)));
  });
}

// ---------------------------------------------------------------------------
// The set: the scene is a sheet taped onto a kraft-paper table, with the
// offcuts of making it lying around the edges.

const SHEET_INSET = 20;
const SCRAP_COLOURS = ['#c8352b', '#e8b52a', '#2f67b3', '#3e8c4a', '#f4efe6', '#ec7a23', '#ffffff', '#8a5a36', '#7fb5d6'];

function tape(ctx: Ctx2D, rng: Rng, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const w = 130 + rng() * 40;
  const h = 40;
  ctx.beginPath();
  // torn ends: zigzag
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  for (let i = 0; i <= 6; i++) ctx.lineTo(w / 2 + (i % 2 ? 5 : -2), -h / 2 + (h * i) / 6);
  ctx.lineTo(-w / 2, h / 2);
  for (let i = 6; i >= 0; i--) ctx.lineTo(-w / 2 + (i % 2 ? -5 : 2), -h / 2 + (h * i) / 6);
  ctx.closePath();
  ctx.shadowColor = 'rgba(30,20,10,0.18)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = 'rgba(236,224,192,0.82)';
  ctx.fill();
  ctx.restore();
}

/** An irregular offcut: a sliver or a corner triangle left over from cutting. */
function offcut(ctx: Ctx2D, rng: Rng, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rng() * Math.PI * 2);
  const colour = SCRAP_COLOURS[Math.floor(rng() * SCRAP_COLOURS.length)];
  const kind = rng();
  ctx.beginPath();
  if (kind < 0.4) {
    // long sliver
    const l = 60 + rng() * 90;
    const t = 8 + rng() * 10;
    ctx.moveTo(-l / 2, 0);
    ctx.lineTo(l / 2, -t / 2 + (rng() - 0.5) * 4);
    ctx.lineTo(l / 2 - 4, t / 2);
    ctx.lineTo(-l / 2 + 6, t / 2 + (rng() - 0.5) * 4);
  } else if (kind < 0.75) {
    // corner triangle
    const a = 30 + rng() * 45;
    ctx.moveTo(0, 0);
    ctx.lineTo(a, 4 * rng());
    ctx.lineTo(rng() * 10, a * (0.7 + rng() * 0.5));
  } else {
    // wobbly curl-cut piece
    const r = 14 + rng() * 22;
    for (let i = 0; i < 9; i++) {
      const t = (i / 9) * Math.PI * 2;
      const rr = r * (0.7 + rng() * 0.5);
      i ? ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr) : ctx.moveTo(Math.cos(t) * rr, Math.sin(t) * rr);
    }
  }
  ctx.closePath();
  ctx.shadowColor = 'rgba(20,14,8,0.35)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.restore();
}

function confetti(ctx: Ctx2D, rng: Rng, x: number, y: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(20,14,8,0.3)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1.5;
  ctx.fillStyle = SCRAP_COLOURS[Math.floor(rng() * SCRAP_COLOURS.length)];
  ctx.beginPath();
  ctx.arc(x, y, 5 + rng() * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A point in the border band: within `band` px of an edge, avoiding the top centre where the title sits. */
function edgePoint(rng: Rng, band: number): [number, number] {
  for (;;) {
    const side = Math.floor(rng() * 4);
    const along = rng();
    const into = rng() * band;
    const p: [number, number] =
      side === 0 ? [along * WIDTH, into] : side === 1 ? [WIDTH - into, along * HEIGHT] : side === 2 ? [along * WIDTH, HEIGHT - into] : [into, along * HEIGHT];
    if (!(p[1] < 260 && p[0] > 200 && p[0] < WIDTH - 200)) return p;
  }
}

export function setTexture(kind: Exclude<SceneKind, 'none'>): DrawableImage {
  return cachedTexture(`set|${kind}`, WIDTH, HEIGHT, (ctx) => {
    const rng = mulberry32(hashInts(0x5e7, kind.length, kind.charCodeAt(0), kind.charCodeAt(kind.length - 1)));
    // kraft-paper table
    ctx.fillStyle = '#b58a5c';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(paperTexture('#ffffff', 11), 0, 0);
    ctx.restore();
    // the scene sheet, a hair off square
    const w = WIDTH - 2 * SHEET_INSET;
    const h = HEIGHT - 2 * SHEET_INSET;
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.rotate(-0.0045);
    ctx.shadowColor = 'rgba(30,18,6,0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 7;
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    ctx.drawImage(sceneTexture(kind, 1), -w / 2, -h / 2, w, h);
    ctx.restore();
    // tape on the corners
    tape(ctx, rng, SHEET_INSET + 34, SHEET_INSET + 22, -0.7 + rng() * 0.2);
    tape(ctx, rng, WIDTH - SHEET_INSET - 34, SHEET_INSET + 22, 0.7 - rng() * 0.2);
    tape(ctx, rng, SHEET_INSET + 34, HEIGHT - SHEET_INSET - 22, 0.7 - rng() * 0.2);
    tape(ctx, rng, WIDTH - SHEET_INSET - 34, HEIGHT - SHEET_INSET - 22, -0.7 + rng() * 0.2);
    // offcuts and punched confetti around the edges
    for (let i = 0; i < 16; i++) offcut(ctx, rng, ...edgePoint(rng, 46));
    for (let i = 0; i < 22; i++) confetti(ctx, rng, ...edgePoint(rng, 40));
    // a curled paper strip lying across a corner
    ctx.save();
    ctx.translate(WIDTH - 90, HEIGHT - 140);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.moveTo(-70, 0);
    ctx.bezierCurveTo(-20, -30, 20, 30, 70, 0);
    ctx.lineWidth = 12;
    ctx.lineCap = 'butt';
    ctx.shadowColor = 'rgba(20,14,8,0.35)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 4;
    ctx.strokeStyle = '#e8b52a';
    ctx.stroke();
    ctx.restore();
  });
}
