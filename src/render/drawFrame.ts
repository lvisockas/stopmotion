import { computeLayout, type Element, type Layout } from './layout';
import { dropPose, type DropFlavor, type DropPose } from './motion';
import { rngFor, signed, STREAM } from './prng';
import { GRAIN_TILE, GRAIN_VARIANTS, grainTile, paperTexture } from './textures';
import { dropSchedule, sampleStep } from './timeline';
import { HEIGHT, WIDTH, type AssetLookup, type Ctx2D, type Slide } from './types';

const DEG = Math.PI / 180;
const JITTER_PX = 2;
const JITTER_ROT = 0.5 * DEG;
const LABEL_PAPER = '#fbf8f1';

/**
 * Slides are treated as immutable values (the editor replaces, never
 * mutates), so the resting layout can be cached per slide object.
 */
const layoutCache = new WeakMap<Slide, Layout>();
export function getLayout(ctx: Ctx2D, slide: Slide): Layout {
  let layout = layoutCache.get(slide);
  if (!layout) {
    layout = computeLayout(ctx, slide);
    layoutCache.set(slide, layout);
  }
  return layout;
}

function flavorFor(slide: Slide, index: number): DropFlavor {
  const rng = rngFor(slide.seed, STREAM.drop, index);
  // mostly from above and toward the camera, a bit left or right
  const angle = -Math.PI / 2 + signed(rng) * 0.9;
  return {
    fromX: Math.cos(angle),
    fromY: Math.sin(angle),
    distance: 140 + rng() * 140,
    spin: signed(rng) * 14 * DEG,
  };
}

function applyShadow(ctx: Ctx2D, lift: number) {
  ctx.shadowColor = `rgba(20, 14, 8, ${0.32 - 0.12 * lift})`;
  ctx.shadowBlur = 10 + 44 * lift;
  ctx.shadowOffsetX = 3 + 26 * lift;
  ctx.shadowOffsetY = 7 + 46 * lift;
}

function clearShadow(ctx: Ctx2D) {
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawElement(ctx: Ctx2D, slide: Slide, el: Element, pose: DropPose, assets: AssetLookup) {
  const { w, h } = el.place;
  const x = -w / 2;
  const y = -h / 2;
  if (el.kind === 'image') {
    const img = assets(el.image.id);
    applyShadow(ctx, pose.lift);
    ctx.fillStyle = el.border > 0 ? '#ffffff' : '#d9d4ca';
    ctx.fillRect(x, y, w, h);
    clearShadow(ctx);
    const b = el.border;
    if (img) {
      ctx.drawImage(img, el.src.x, el.src.y, el.src.w, el.src.h, x + b, y + b, w - 2 * b, h - 2 * b);
    } else {
      ctx.fillStyle = '#bdb6a8';
      ctx.fillRect(x + b, y + b, w - 2 * b, h - 2 * b);
    }
    // the cut edge
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    return;
  }
  const { block, pad } = el;
  if (pad > 0) {
    applyShadow(ctx, pose.lift);
    ctx.fillStyle = LABEL_PAPER;
    ctx.fillRect(x, y, w, h);
    clearShadow(ctx);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  } else {
    ctx.shadowColor = `rgba(0,0,0,${0.18 + 0.1 * pose.lift})`;
    ctx.shadowBlur = 4 + 24 * pose.lift;
    ctx.shadowOffsetX = 2 + 16 * pose.lift;
    ctx.shadowOffsetY = 3 + 26 * pose.lift;
  }
  ctx.font = block.font;
  ctx.fillStyle = slide.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  block.lines.forEach((line, i) => {
    ctx.fillText(line, 0, y + pad + block.lineHeight * (i + 0.5));
  });
  clearShadow(ctx);
}

function drawVignette(ctx: Ctx2D) {
  const g = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.3, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawGrain(ctx: Ctx2D, slide: Slide, step: number) {
  const rng = rngFor(slide.seed, STREAM.grain, step);
  const tile = grainTile(Math.floor(rng() * GRAIN_VARIANTS));
  const ox = -Math.floor(rng() * GRAIN_TILE);
  const oy = -Math.floor(rng() * GRAIN_TILE);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.2;
  for (let y = oy; y < HEIGHT; y += GRAIN_TILE) {
    for (let x = ox; x < WIDTH; x += GRAIN_TILE) ctx.drawImage(tile, x, y);
  }
  ctx.restore();
}

function drawFlicker(ctx: Ctx2D, slide: Slide, step: number) {
  const e = signed(rngFor(slide.seed, STREAM.flicker, step)) * 0.045;
  ctx.fillStyle = e > 0 ? `rgba(255,250,240,${e})` : `rgba(0,0,0,${-e})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/**
 * Draws frame `frameIndex` (at 30 fps) of `slide` onto a 1080×1350 context.
 *
 * Pure and deterministic: the pixels depend only on (slide, frameIndex, the
 * decoded images). Preview and export both call this; nothing else draws.
 * Images must already be decoded and fonts loaded, or text metrics differ.
 */
export function drawFrame(ctx: Ctx2D, slide: Slide, frameIndex: number, assets: AssetLookup): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  clearShadow(ctx);

  if (slide.effects.paper) {
    ctx.drawImage(paperTexture(slide.background, slide.seed), 0, 0);
  } else {
    ctx.fillStyle = slide.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  const { step, time } = sampleStep(frameIndex, slide.stopMotionFps);
  const layout = getLayout(ctx, slide);
  const schedule = dropSchedule(layout.elements.length, slide.duration);

  layout.elements.forEach((el, i) => {
    const t = schedule[i];
    const pose = dropPose((time - t.start) / t.duration, flavorFor(slide, i));
    if (!pose.visible) return;
    // hand-placed between shots: every element shifts a hair on every step
    const jr = rngFor(slide.seed, STREAM.jitter, step, i);
    const jx = signed(jr) * JITTER_PX;
    const jy = signed(jr) * JITTER_PX;
    const jrot = signed(jr) * JITTER_ROT;
    ctx.save();
    ctx.translate(el.place.cx + pose.dx + jx, el.place.cy + pose.dy + jy);
    ctx.rotate(el.place.rot + pose.rot + jrot);
    ctx.scale(pose.scale, pose.scale);
    drawElement(ctx, slide, el, pose, assets);
    ctx.restore();
  });

  if (slide.effects.vignette) drawVignette(ctx);
  if (slide.effects.grain) drawGrain(ctx, slide, step);
  if (slide.effects.flicker) drawFlicker(ctx, slide, step);
  ctx.restore();
}
