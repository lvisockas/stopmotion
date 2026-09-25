import type { Bubble } from './layout';
import { mulberry32, hashInts } from './prng';
import { paperTexture } from './textures';
import type { Ctx2D } from './types';

const INK = '#2a2320';
const CARD = '#fbf8f0';

export interface BubbleState {
  /** Vertical offset from the resting position (stacking above a newer bubble). */
  lift: number;
  /** Pop-in scale. */
  scale: number;
  /** How many characters of the text are showing (typewriter). */
  shown: number;
  dx: number;
  dy: number;
  rot: number;
  /** Seeds the hand-cut edge, so each bubble keeps its own shape. */
  seed: number;
}

/**
 * The bubble's outline as one hand-cut silhouette: a squircle body with a
 * slightly wobbly scissor edge, and a tapered tail cut from the same card.
 */
function cutPath(ctx: Ctx2D, b: Bubble, top: number, seed: number) {
  const rng = mulberry32(hashInts(seed, 0xb0b));
  const cx = b.x + b.w / 2;
  const cy = top + b.h / 2;
  const a = b.w / 2;
  const bb = b.h / 2;
  const n = 5;
  const steps = 64;
  const wobble = Array.from({ length: 9 }, () => (rng() - 0.5) * 0.028);
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    // low-frequency wobble: scissors, not noise
    const k = 1 + wobble[Math.floor((i / steps) * 8) % 9] * (1 - Math.abs(((i / steps) * 8) % 1 - 0.5));
    const x = cx + a * k * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + bb * k * Math.sign(s) * Math.abs(s) ** (2 / n);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  // tail: base inside the body's bottom edge, curving to the speaker
  const bottom = top + b.h;
  const baseX = Math.min(Math.max(b.tipX, b.x + b.w * 0.22), b.x + b.w * 0.78);
  const lean = (b.tipX - baseX) * 0.4;
  ctx.moveTo(baseX - 34, bottom - 18);
  ctx.quadraticCurveTo(baseX - 8 + lean, bottom + (b.tipY - bottom) * 0.5, b.tipX, b.tipY);
  ctx.quadraticCurveTo(baseX + 12 + lean, bottom + (b.tipY - bottom) * 0.35, baseX + 30, bottom - 18);
  ctx.closePath();
}

/** A speech bubble cut from card, lifted off the set, with hand-lettered text typed so far. */
export function drawBubble(ctx: Ctx2D, b: Bubble, st: BubbleState): void {
  const top = b.bottom - b.h - st.lift;
  const cx = b.x + b.w / 2;
  const cy = top + b.h / 2;
  const tilt = (mulberry32(hashInts(st.seed, 0x7117))() - 0.5) * 0.05;
  ctx.save();
  ctx.translate(cx + st.dx, cy + st.dy);
  ctx.rotate(st.rot + tilt);
  ctx.scale(st.scale, st.scale);
  ctx.translate(-cx, -cy);

  // lifted card: soft contact shadow
  cutPath(ctx, b, top, st.seed);
  ctx.save();
  ctx.shadowColor = 'rgba(30,20,10,0.32)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.restore();
  // cut edge: stroke the silhouette, then fill again so only its outer half
  // shows (no seam where the tail joins the body)
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(60,45,30,0.28)';
  ctx.stroke();
  ctx.fillStyle = CARD;
  ctx.fill();
  // card fibre
  ctx.save();
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.7;
  ctx.drawImage(paperTexture('#ffffff', 3), b.x - 40, top - 200);
  ctx.restore();

  // hand lettering, revealed a character at a time
  ctx.font = b.block.font;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let left = st.shown;
  const textTop = cy - b.block.height / 2;
  b.block.lines.forEach((line, i) => {
    if (left <= 0) return;
    const chars = Array.from(line);
    const part = chars.slice(0, left).join('');
    left -= chars.length + 1; // +1: the space the wrap consumed
    const lineW = ctx.measureText(line).width;
    ctx.fillText(part, cx - lineW / 2, textTop + b.block.lineHeight * (i + 0.55));
  });
  ctx.restore();
}

/** Total characters in a bubble's wrapped text, counting one per line break. */
export const bubbleLength = (b: Bubble) =>
  b.block.lines.reduce((n, l) => n + Array.from(l).length, 0) + b.block.lines.length - 1;
