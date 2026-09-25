import type { Bubble } from './layout';
import type { Ctx2D } from './types';

const INK = '#1b1714';
const RADIUS = 30;

function roundedRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

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
}

/** A comic speech bubble: white, ink outline, tail to the speaker, text typed so far. */
export function drawBubble(ctx: Ctx2D, b: Bubble, st: BubbleState): void {
  const top = b.bottom - b.h - st.lift;
  const cx = b.x + b.w / 2;
  const cy = top + b.h / 2;
  ctx.save();
  ctx.translate(cx + st.dx, cy + st.dy);
  ctx.rotate(st.rot);
  ctx.scale(st.scale, st.scale);
  ctx.translate(-cx, -cy);

  // tail: base on the bubble's bottom edge, tip above the speaker's head
  const baseX = Math.min(Math.max(b.tipX, b.x + RADIUS + 22), b.x + b.w - RADIUS - 22);
  const bottom = top + b.h;
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(baseX - 20, bottom - 6);
    ctx.lineTo(b.tipX, b.tipY);
    ctx.lineTo(baseX + 20, bottom - 6);
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(20,14,8,0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;
  tail();
  ctx.fill();
  roundedRect(ctx, b.x, top, b.w, b.h, RADIUS);
  ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  tail();
  ctx.stroke();
  roundedRect(ctx, b.x, top, b.w, b.h, RADIUS);
  ctx.stroke();
  // paint over the outline where the tail joins the bubble
  ctx.beginPath();
  ctx.moveTo(baseX - 17, bottom - 8);
  ctx.lineTo(b.tipX + (b.tipX - baseX) * -0.02, b.tipY + (bottom - b.tipY) * 0.35);
  ctx.lineTo(baseX + 17, bottom - 8);
  ctx.closePath();
  ctx.fill();

  // typewriter text
  ctx.font = b.block.font;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let left = st.shown;
  b.block.lines.forEach((line, i) => {
    if (left <= 0) return;
    const chars = Array.from(line);
    const part = chars.slice(0, left).join('');
    left -= chars.length + 1; // +1: the space the wrap consumed
    const lineW = ctx.measureText(line).width;
    ctx.fillText(part, cx - lineW / 2, top + 18 + b.block.lineHeight * (i + 0.5));
  });
  ctx.restore();
}

/** Total characters in a bubble's wrapped text, counting one per line break. */
export const bubbleLength = (b: Bubble) =>
  b.block.lines.reduce((n, l) => n + Array.from(l).length, 0) + b.block.lines.length - 1;
