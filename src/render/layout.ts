import { rngFor, signed, STREAM } from './prng';
import { CHARACTER_H, CHARACTER_W, lookFor, type Look } from './character';
import { BUBBLE_SPEC, layoutText, SUBTITLE_SPEC, TITLE_SPEC, type TextBlock } from './text';
import { HEIGHT, SAFE_MARGIN, WIDTH, type Ctx2D, type Slide, type SlideImage } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A cutout at rest: centre, drawn size (including border), rotation. */
export interface Placement {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
}

export interface ImageElement {
  kind: 'image';
  image: SlideImage;
  place: Placement;
  /** Border width in px (0 when the slide has cutout borders off). */
  border: number;
  /** Source crop rect in image pixels (the whole image unless fit = fill). */
  src: Rect;
}

export interface TextElement {
  kind: 'text';
  role: 'title' | 'subtitle';
  block: TextBlock;
  place: Placement;
  /** Label padding around the text, px (0 for plain text). */
  pad: number;
}

export interface CharacterElement {
  kind: 'character';
  /** Index into slide.cast. */
  index: number;
  look: Look;
  place: Placement;
  /** -1 looks left, 0 ahead, 1 right. */
  gaze: number;
}

export type Element = ImageElement | TextElement | CharacterElement;

/** A speech bubble at rest (before any stacking with the previous bubble). */
export interface Bubble {
  speaker: number;
  block: TextBlock;
  x: number;
  bottom: number;
  w: number;
  h: number;
  /** Where the tail points: just above the speaker's head. */
  tipX: number;
  tipY: number;
}

export interface Layout {
  /** In drop order: title, screenshots, subtitle (top-anchored with a cast), characters. */
  elements: Element[];
  imageArea: Rect;
  /** One per slide.lines entry; null when the speaker doesn't exist. */
  bubbles: (Bubble | null)[];
}

/** Keep resting elements this far inside the safe margin so jitter can't cross it. */
const JITTER_ROOM = 4;
const LABEL_PAD = 26;
const GAP = 36;
const MAX_IMAGE_TILT = (5 * Math.PI) / 180;
const MAX_TEXT_TILT = (1.6 * Math.PI) / 180;
const MAX_CHARACTER_TILT = (2 * Math.PI) / 180;
const BUBBLE_PAD_X = 26;
const BUBBLE_PAD_Y = 18;
/** Horizontal slots for 1, 2 or 3 characters, as fractions of the safe width. */
const CAST_SLOTS = [[0.5], [0.2, 0.8], [0.16, 0.5, 0.84]];

export const SAFE: Rect = {
  x: SAFE_MARGIN + JITTER_ROOM,
  y: SAFE_MARGIN + JITTER_ROOM,
  w: WIDTH - 2 * (SAFE_MARGIN + JITTER_ROOM),
  h: HEIGHT - 2 * (SAFE_MARGIN + JITTER_ROOM),
};

/** Axis-aligned half extents of a w×h box rotated by rot. */
function halfExtents(w: number, h: number, rot: number) {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  return { hx: (w * c + h * s) / 2, hy: (w * s + h * c) / 2 };
}

/**
 * Shrinks (if needed) and nudges a rotated box so its bounding box sits
 * inside `bounds`. Mutates and returns the placement.
 */
export function containPlacement(p: Placement, bounds: Rect): Placement {
  let { hx, hy } = halfExtents(p.w, p.h, p.rot);
  const k = Math.min(1, bounds.w / (2 * hx), bounds.h / (2 * hy));
  if (k < 1) {
    p.w *= k;
    p.h *= k;
    hx *= k;
    hy *= k;
  }
  p.cx = Math.min(Math.max(p.cx, bounds.x + hx), bounds.x + bounds.w - hx);
  p.cy = Math.min(Math.max(p.cy, bounds.y + hy), bounds.y + bounds.h - hy);
  return p;
}

interface Grid {
  cols: number;
  rows: number;
}

/** Rows × cols that shows the screenshots biggest, judged by total fitted area. */
function chooseGrid(images: SlideImage[], area: Rect): Grid {
  const n = images.length;
  let best: Grid = { cols: 1, rows: n };
  let bestScore = -1;
  for (let cols = 1; cols <= Math.min(n, 3); cols++) {
    const rows = Math.ceil(n / cols);
    const cw = area.w / cols;
    const ch = area.h / rows;
    let score = 0;
    for (const img of images) {
      const s = Math.min(cw / img.width, ch / img.height);
      score += img.width * s * img.height * s;
    }
    // small bias toward fewer columns: headline strips read best full width
    score *= 1 - 0.04 * (cols - 1);
    if (score > bestScore) {
      bestScore = score;
      best = { cols, rows };
    }
  }
  return best;
}

function placeImages(slide: Slide, area: Rect): ImageElement[] {
  const images = slide.images;
  const n = images.length;
  if (n === 0) return [];
  const { cols, rows } = chooseGrid(images, area);
  const cw = area.w / cols;
  const ch = area.h / rows;
  // overlapping a bit is what makes it a pile rather than a grid
  const grow = n === 1 ? 1 : 1.16;
  const border = slide.cutoutBorder ? 12 : 0;
  return images.map((image, i) => {
    const rng = rngFor(slide.seed, STREAM.layout, i);
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = i - row * cols;
    // centre short last rows
    const rowOffset = ((cols - inRow) * cw) / 2;
    const cx0 = area.x + rowOffset + (col + 0.5) * cw;
    const cy0 = area.y + (row + 0.5) * ch;
    const rot = signed(rng) * MAX_IMAGE_TILT * (n === 1 ? 0.5 : 1);
    const scatter = n === 1 ? 0.02 : 0.08;
    let w: number;
    let h: number;
    let src: Rect;
    if (slide.fit === 'fill') {
      w = cw * grow * 0.94;
      h = ch * grow * 0.94;
      const inner = { w: w - 2 * border, h: h - 2 * border };
      const s = Math.max(inner.w / image.width, inner.h / image.height);
      const sw = inner.w / s;
      const sh = inner.h / s;
      src = { x: (image.width - sw) / 2, y: (image.height - sh) / 2, w: sw, h: sh };
    } else {
      const s = Math.min((cw * grow - 2 * border) / image.width, (ch * grow - 2 * border) / image.height);
      w = image.width * s + 2 * border;
      h = image.height * s + 2 * border;
      src = { x: 0, y: 0, w: image.width, h: image.height };
    }
    const place = containPlacement(
      { cx: cx0 + signed(rng) * cw * scatter, cy: cy0 + signed(rng) * ch * scatter, w, h, rot },
      area,
    );
    // containPlacement scales uniformly, so the crop aspect still matches
    return { kind: 'image' as const, image, place, border: border * (place.w / w), src };
  });
}

function placeText(
  ctx: Ctx2D,
  slide: Slide,
  role: 'title' | 'subtitle',
  text: string,
  top: number | null,
  bottom: number | null,
): TextElement | null {
  const pad = slide.textStyle === 'label' ? LABEL_PAD : 0;
  const maxWidth = SAFE.w - 2 * pad - 16; // 16: room for the tilt
  const block = layoutText(ctx, text, maxWidth, role === 'title' ? TITLE_SPEC : SUBTITLE_SPEC);
  if (!block) return null;
  const rng = rngFor(slide.seed, STREAM.layout, role === 'title' ? 1001 : 1002);
  const w = block.width + 2 * pad;
  const h = block.height + 2 * pad;
  const rot = signed(rng) * MAX_TEXT_TILT;
  const { hy } = halfExtents(w, h, rot);
  const cy = top !== null ? top + hy : (bottom as number) - hy;
  const place = containPlacement({ cx: WIDTH / 2 + signed(rng) * 20, cy, w, h, rot }, SAFE);
  return { kind: 'text', role, block, place, pad };
}

function placeCast(slide: Slide): CharacterElement[] {
  const n = Math.min(slide.cast.length, 3);
  if (n === 0) return [];
  const slots = CAST_SLOTS[n - 1];
  const cy = SAFE.y + SAFE.h - CHARACTER_H / 2;
  return slide.cast.slice(0, n).map((member, index) => {
    const rng = rngFor(slide.seed, STREAM.layout, 2000 + index);
    const cx = SAFE.x + SAFE.w * slots[index];
    // everyone faces the middle of the group
    const gaze = n === 1 ? 0 : slots[index] < 0.5 ? 1 : -1;
    const place = containPlacement(
      { cx: cx + signed(rng) * 10, cy, w: CHARACTER_W, h: CHARACTER_H, rot: signed(rng) * MAX_CHARACTER_TILT },
      SAFE,
    );
    return { kind: 'character' as const, index, look: lookFor(member.seed), place, gaze };
  });
}

function placeBubbles(ctx: Ctx2D, slide: Slide, cast: CharacterElement[]): (Bubble | null)[] {
  // two speakers: narrow enough that left and right bubbles never overlap
  const maxText = (cast.length === 1 ? 720 : cast.length === 2 ? 440 : 400) - 2 * BUBBLE_PAD_X;
  return slide.lines.map((line) => {
    const who = cast[line.speaker];
    if (!who) return null;
    const block = layoutText(ctx, line.text, maxText, BUBBLE_SPEC);
    if (!block) return null;
    const w = block.width + 2 * BUBBLE_PAD_X;
    const h = block.height + 2 * BUBBLE_PAD_Y;
    const top = who.place.cy - who.place.h / 2;
    const x = Math.min(Math.max(who.place.cx - w / 2 + who.gaze * 40, SAFE.x), SAFE.x + SAFE.w - w);
    return { speaker: line.speaker, block, x, bottom: top - 26, w, h, tipX: who.place.cx + who.gaze * 30, tipY: top + 6 };
  });
}

/** Where everything comes to rest. Pure in (slide, ctx font metrics). */
export function computeLayout(ctx: Ctx2D, slide: Slide): Layout {
  ctx.save();
  const cast = placeCast(slide);
  const title = placeText(ctx, slide, 'title', slide.title, SAFE.y, null);
  const titleBottom = title ? title.place.cy + halfExtents(title.place.w, title.place.h, title.place.rot).hy + GAP : SAFE.y;
  // with characters on the floor, the subtitle becomes a caption under the title
  const subtitle = cast.length
    ? placeText(ctx, slide, 'subtitle', slide.subtitle, title ? titleBottom - GAP / 2 : SAFE.y, null)
    : placeText(ctx, slide, 'subtitle', slide.subtitle, null, SAFE.y + SAFE.h);
  const bubbles = placeBubbles(ctx, slide, cast);
  ctx.restore();
  const extent = (t: TextElement) => halfExtents(t.place.w, t.place.h, t.place.rot).hy;
  let top = titleBottom;
  let bottom = subtitle ? subtitle.place.cy - extent(subtitle) - GAP : SAFE.y + SAFE.h;
  if (cast.length) {
    if (subtitle) top = subtitle.place.cy + extent(subtitle) + GAP;
    const tallest = Math.max(0, ...bubbles.map((b) => (b ? b.h : 0)));
    const castTop = Math.min(...cast.map((c) => c.place.cy - c.place.h / 2));
    bottom = castTop - (tallest ? Math.min(tallest + 40, 200) : GAP);
  }
  const imageArea: Rect = { x: SAFE.x, y: top, w: SAFE.w, h: Math.max(120, bottom - top) };
  const elements: Element[] = [];
  if (title) elements.push(title);
  if (subtitle && cast.length) elements.push(subtitle);
  elements.push(...placeImages(slide, imageArea));
  if (subtitle && !cast.length) elements.push(subtitle);
  elements.push(...cast);
  return { elements, imageArea, bubbles };
}
